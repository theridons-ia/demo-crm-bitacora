import { MapPin } from "lucide-react";
import { useEffect, useId, useState } from "react";
import {
  visitGpsProofHint,
  visitGpsProofLabel,
  type VisitGpsProof,
} from "../lib/visitEvidence";

const LEGEND: Exclude<VisitGpsProof, "photo" | "none">[] = ["fiable", "parcial", "deficiente"];

type PinProps = {
  kind: VisitGpsProof;
  size?: number;
};

/** Pin GPS (gota invertida) con el color de la prueba. */
export function GpsProofPin({ kind, size = 14 }: PinProps) {
  if (kind === "none") return null;
  return (
    <MapPin
      size={size}
      fill="currentColor"
      stroke="currentColor"
      strokeWidth={1.6}
      className={`gps-proof-pin is-${kind}`}
      aria-hidden
    />
  );
}

type LegendProps = {
  counts?: { fiable: number; parcial: number; deficiente: number };
};

/** Leyenda de prueba GPS en listas de visitas culminadas. */
export function GpsProofLegend({ counts }: LegendProps) {
  const uid = useId();
  const [open, setOpen] = useState<VisitGpsProof | null>(null);

  useEffect(() => {
    if (!open) return;
    function close() {
      setOpen(null);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(null);
    }
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <ul className="proof-legend" aria-label="Leyenda de presencia en el PDV">
      {LEGEND.map((key) => {
        const label = visitGpsProofLabel(key);
        const hint = visitGpsProofHint(key);
        const tipId = `${uid}-${key}`;
        const isOpen = open === key;
        return (
          <li key={key} className={`proof-legend-item is-${key}${isOpen ? " is-open" : ""}`}>
            <button
              type="button"
              className="proof-legend-btn"
              aria-expanded={isOpen}
              aria-describedby={isOpen ? tipId : undefined}
              title={hint ?? undefined}
              onPointerDown={(event) => event.stopPropagation()}
              onClick={() => setOpen((prev) => (prev === key ? null : key))}
            >
              <span>
                {counts != null ? `${counts[key]} · ` : null}
                {label}
              </span>
            </button>
            {hint ? (
              <span id={tipId} role="tooltip" className="proof-legend-tip">
                {hint}
              </span>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
