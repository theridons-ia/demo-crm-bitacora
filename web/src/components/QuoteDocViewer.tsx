import { X } from "lucide-react";
import {
  useEffect,
  useRef,
  useState,
  type PointerEvent,
  type ReactNode,
  type WheelEvent,
} from "react";
import { createPortal } from "react-dom";
import { Button } from "./Button";
import { useBodyScrollLock, useEscapeKey } from "../hooks/useOverlay";

type Props = {
  open: boolean;
  src: string | null;
  alt: string;
  onClose: () => void;
  fallback?: ReactNode;
};

const MIN = 1;
const MAX = 4.5;

type Pt = { x: number; y: number };

function dist(a: Pt, b: Pt) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/** Visor de la OV: pinch / rueda para zoom, un dedo para mover. */
export function QuoteDocViewer({ open, src, alt, onClose, fallback }: Props) {
  const [scale, setScale] = useState(1);
  const [pos, setPos] = useState<Pt>({ x: 0, y: 0 });
  const pointers = useRef(new Map<number, Pt>());
  const pinch = useRef({ dist: 0, scale: 1 });
  const lastTap = useRef(0);

  useEscapeKey(open, onClose);
  useBodyScrollLock(open);

  useEffect(() => {
    if (!open) {
      setScale(1);
      setPos({ x: 0, y: 0 });
      pointers.current.clear();
    }
  }, [open]);

  if (!open || typeof document === "undefined") return null;

  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    event.currentTarget.setPointerCapture(event.pointerId);
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      pinch.current = { dist: dist(a, b), scale };
    }
    if (pointers.current.size === 1) {
      const now = Date.now();
      if (event.pointerType !== "mouse" && now - lastTap.current < 280) {
        setScale((s) => (s > 1.2 ? 1 : 2.4));
        setPos({ x: 0, y: 0 });
      }
      lastTap.current = now;
    }
  }

  function onPointerMove(event: PointerEvent<HTMLDivElement>) {
    if (!pointers.current.has(event.pointerId)) return;
    const prev = pointers.current.get(event.pointerId)!;
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const pts = [...pointers.current.values()];
    if (pts.length >= 2) {
      const d = dist(pts[0], pts[1]);
      if (pinch.current.dist > 0) {
        const next = Math.min(MAX, Math.max(MIN, pinch.current.scale * (d / pinch.current.dist)));
        setScale(next);
      }
      return;
    }
    if (scale <= 1.02) return;
    const dx = event.clientX - prev.x;
    const dy = event.clientY - prev.y;
    setPos((p) => ({ x: p.x + dx, y: p.y + dy }));
  }

  function onPointerUp(event: PointerEvent<HTMLDivElement>) {
    pointers.current.delete(event.pointerId);
    if (pointers.current.size < 2) pinch.current.dist = 0;
  }

  function onWheel(event: WheelEvent<HTMLDivElement>) {
    event.preventDefault();
    const factor = event.deltaY < 0 ? 1.12 : 0.9;
    setScale((s) => Math.min(MAX, Math.max(MIN, s * factor)));
  }

  return createPortal(
    <div className="quote-doc-viewer" role="dialog" aria-modal="true" aria-label="Vista previa">
      <button type="button" className="app-overlay-backdrop" aria-label="Cerrar" onClick={onClose} />
      <div className="quote-doc-viewer-bar">
        <p className="eyebrow">Documento</p>
        <strong>{alt}</strong>
        <Button type="button" variant="ghost" onClick={onClose} aria-label="Cerrar">
          <X size={18} />
        </Button>
      </div>
      <div
        className="quote-doc-viewer-stage"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onWheel={onWheel}
      >
        {src ? (
          <img
            src={src}
            alt={alt}
            draggable={false}
            style={{ transform: `translate(${pos.x}px, ${pos.y}px) scale(${scale})` }}
          />
        ) : (
          <div
            className="quote-doc-viewer-html"
            style={{ transform: `translate(${pos.x}px, ${pos.y}px) scale(${scale})` }}
          >
            {fallback}
          </div>
        )}
      </div>
      <p className="quote-doc-viewer-hint">Pellizca para zoom · arrastra para mover · doble toque amplia</p>
    </div>,
    document.body,
  );
}
