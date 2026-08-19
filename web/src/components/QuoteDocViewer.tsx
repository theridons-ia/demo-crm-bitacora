import { ChevronLeft, ChevronRight, X } from "lucide-react";
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
  src?: string | null;
  sources?: string[];
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

/** Visor de documento o comprobante: pinch / rueda para zoom, un dedo para mover o pasar fotos. */
export function QuoteDocViewer({ open, src = null, sources, alt, onClose, fallback }: Props) {
  const images = (sources?.filter(Boolean) ?? []).length
    ? sources!.filter(Boolean)
    : src
      ? [src]
      : [];
  const [index, setIndex] = useState(0);
  const [scale, setScale] = useState(1);
  const [pos, setPos] = useState<Pt>({ x: 0, y: 0 });
  const pointers = useRef(new Map<number, Pt>());
  const pinch = useRef({ dist: 0, scale: 1 });
  const lastTap = useRef(0);
  const swipeStart = useRef<Pt | null>(null);

  useEscapeKey(open, onClose);
  useBodyScrollLock(open);

  useEffect(() => {
    if (!open) {
      setIndex(0);
      setScale(1);
      setPos({ x: 0, y: 0 });
      pointers.current.clear();
      swipeStart.current = null;
    }
  }, [open]);

  useEffect(() => {
    setScale(1);
    setPos({ x: 0, y: 0 });
  }, [index]);

  const safeIndex = images.length ? Math.min(index, images.length - 1) : 0;
  const current = images[safeIndex] ?? null;
  const canPrev = safeIndex > 0;
  const canNext = safeIndex < images.length - 1;

  if (!open || typeof document === "undefined") return null;

  function go(delta: number) {
    setIndex((i) => Math.max(0, Math.min(images.length - 1, i + delta)));
  }

  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    event.currentTarget.setPointerCapture(event.pointerId);
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      pinch.current = { dist: dist(a, b), scale };
      swipeStart.current = null;
    }
    if (pointers.current.size === 1) {
      const now = Date.now();
      if (event.pointerType !== "mouse" && now - lastTap.current < 280) {
        setScale((s) => (s > 1.2 ? 1 : 2.4));
        setPos({ x: 0, y: 0 });
        swipeStart.current = null;
      } else if (scale <= 1.02 && images.length > 1) {
        swipeStart.current = { x: event.clientX, y: event.clientY };
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
    const start = swipeStart.current;
    pointers.current.delete(event.pointerId);
    if (pointers.current.size < 2) pinch.current.dist = 0;
    if (start && scale <= 1.02 && images.length > 1) {
      const dx = event.clientX - start.x;
      if (dx <= -56) go(1);
      else if (dx >= 56) go(-1);
    }
    swipeStart.current = null;
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
        <p className="eyebrow">{images.length > 1 ? `Foto ${safeIndex + 1} de ${images.length}` : "Documento"}</p>
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
        {images.length > 1 ? (
          <>
            <button
              type="button"
              className="quote-doc-viewer-nav is-prev"
              disabled={!canPrev}
              aria-label="Foto anterior"
              onClick={() => go(-1)}
            >
              <ChevronLeft size={22} />
            </button>
            <button
              type="button"
              className="quote-doc-viewer-nav is-next"
              disabled={!canNext}
              aria-label="Foto siguiente"
              onClick={() => go(1)}
            >
              <ChevronRight size={22} />
            </button>
          </>
        ) : null}
        {current ? (
          <img
            src={current}
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
      <p className="quote-doc-viewer-hint">
        {images.length > 1
          ? "Desliza para pasar · pellizca para zoom"
          : "Pellizca para zoom · arrastra para mover · doble toque amplia"}
      </p>
    </div>,
    document.body,
  );
}
