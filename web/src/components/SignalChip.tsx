import { Wifi, WifiOff, WifiLow } from "lucide-react";
import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNetworkStatus, type SignalKind } from "../network/NetworkStatus";

const COPY: Record<SignalKind, { label: string; hint: string }> = {
  online: {
    label: "En línea",
    hint: "Hay conexión con el servidor. Toca de nuevo para volver a comprobar.",
  },
  degraded: {
    label: "Señal débil",
    hint: "Hay red, pero el servidor tarda o falla a ratos. No es lo mismo que modo avión: la app sigue con lo último guardado.",
  },
  offline: {
    label: "Sin señal",
    hint: "No llega al servidor (modo avión, Wi‑Fi caído o sin datos). La pantalla no se borra: puedes seguir con lo último guardado y la cola offline.",
  },
};

const PAD = 12;

function checkedLabel(checkedAt: number | null): string {
  if (checkedAt == null) return "Aún no se ha comprobado";
  const sec = Math.max(0, Math.round((Date.now() - checkedAt) / 1000));
  if (sec < 5) return "Comprobado ahora";
  if (sec < 60) return `Última comprobación: hace ${sec} s`;
  const min = Math.round(sec / 60);
  return `Última comprobación: hace ${min} min`;
}

function placeTip(anchor: DOMRect): { top: number; left: number; width: number } {
  const width = Math.min(280, window.innerWidth - PAD * 2);
  let left = anchor.right - width;
  if (left < PAD) left = PAD;
  if (left + width > window.innerWidth - PAD) {
    left = Math.max(PAD, window.innerWidth - PAD - width);
  }
  let top = anchor.bottom + 8;
  const approxH = 140;
  if (top + approxH > window.innerHeight - PAD) {
    top = Math.max(PAD, anchor.top - approxH - 8);
  }
  return { top, left, width };
}

/** Chip compacto de red en el header. Tap abre el detalle y sondea de nuevo. */
export function SignalChip() {
  const { kind, probe, checkedAt } = useNetworkStatus();
  const copy = COPY[kind];
  const Icon = kind === "offline" ? WifiOff : kind === "degraded" ? WifiLow : Wifi;
  const [open, setOpen] = useState(false);
  const [box, setBox] = useState<{ top: number; left: number; width: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  const tipId = useId();

  useLayoutEffect(() => {
    if (!open || !btnRef.current) return;
    function layout() {
      if (!btnRef.current) return;
      setBox(placeTip(btnRef.current.getBoundingClientRect()));
    }
    layout();
    window.addEventListener("resize", layout);
    window.addEventListener("scroll", layout, true);
    return () => {
      window.removeEventListener("resize", layout);
      window.removeEventListener("scroll", layout, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onDoc(event: MouseEvent) {
      const t = event.target as Node;
      if (btnRef.current?.contains(t) || tipRef.current?.contains(t)) return;
      setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className={`signal-chip-wrap${open ? " is-open" : ""}`}>
      <button
        ref={btnRef}
        type="button"
        className={`signal-chip is-${kind}`}
        aria-label={copy.label}
        aria-expanded={open}
        aria-describedby={open ? tipId : undefined}
        onClick={() => {
          setOpen((prev) => !prev);
          probe();
        }}
      >
        <Icon size={16} strokeWidth={2.2} aria-hidden />
        <span className="signal-chip-label">{copy.label}</span>
      </button>
      {open && box && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={tipRef}
              id={tipId}
              role="tooltip"
              className="signal-chip-tip"
              style={{ top: box.top, left: box.left, width: box.width }}
            >
              <strong>{copy.label}</strong>
              <p>{copy.hint}</p>
              <p className="signal-chip-tip-meta">{checkedLabel(checkedAt)}</p>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
