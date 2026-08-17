import { Wifi, WifiOff, WifiLow } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
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

function checkedLabel(checkedAt: number | null): string {
  if (checkedAt == null) return "Aún no se ha comprobado";
  const sec = Math.max(0, Math.round((Date.now() - checkedAt) / 1000));
  if (sec < 5) return "Comprobado ahora";
  if (sec < 60) return `Última comprobación: hace ${sec} s`;
  const min = Math.round(sec / 60);
  return `Última comprobación: hace ${min} min`;
}

/** Chip compacto de red en el header. Tap abre el detalle y sondea de nuevo. */
export function SignalChip() {
  const { kind, probe, checkedAt } = useNetworkStatus();
  const copy = COPY[kind];
  const Icon = kind === "offline" ? WifiOff : kind === "degraded" ? WifiLow : Wifi;
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const tipId = useId();

  useEffect(() => {
    if (!open) return;
    function onDoc(event: MouseEvent) {
      if (!wrapRef.current?.contains(event.target as Node)) setOpen(false);
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
    <div className={`signal-chip-wrap${open ? " is-open" : ""}`} ref={wrapRef}>
      <button
        type="button"
        className={`signal-chip is-${kind}`}
        title={copy.hint}
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
      {open ? (
        <div id={tipId} role="tooltip" className="signal-chip-tip">
          <strong>{copy.label}</strong>
          <p>{copy.hint}</p>
          <p className="signal-chip-tip-meta">{checkedLabel(checkedAt)}</p>
        </div>
      ) : null}
    </div>
  );
}
