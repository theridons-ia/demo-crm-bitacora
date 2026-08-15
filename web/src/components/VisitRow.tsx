import { AlertTriangle, ChevronRight } from "lucide-react";
import { LiveLed } from "./LiveLed";
import { formatAgendaDay, formatTime, todayISO } from "../lib/caracasTime";
import { isVisitOverdue } from "../lib/visitOrder";
import { visitNoteForUi } from "../lib/saleLabels";
import { visitGpsProof, visitGpsProofLabel } from "../lib/visitEvidence";
import type { Visit, VisitStatus } from "../lib/types";

const STATUS_LABEL: Record<VisitStatus, string> = {
  programada: "Programada",
  en_curso: "En curso",
  completada: "Culminada",
  cancelada: "Cancelada",
};

type Props = {
  visit: Visit;
  onClick: () => void;
  /** Número de parada (mapa / orden del día). */
  index?: number;
  /** Reloj = hora agendada (mapa), no hora de cierre. */
  clock?: "agenda";
  /** PDV sin lat/lng: la fila se queda; el polyline salta el hueco. */
  pinMissing?: boolean;
  /** Equipo: quién visita este PDV. */
  showSeller?: boolean;
};

function whenLabel(visit: Visit, clock?: "agenda"): string {
  if (clock === "agenda") {
    const t = visit.scheduled_time ? String(visit.scheduled_time).slice(0, 5) : "";
    return t || "Sin hora";
  }
  if (visit.status === "en_curso") return "En curso";
  if (visit.status === "cancelada") return "Cancelada";
  if (visit.status === "completada") {
    return formatTime(visit.visited_at || visit.created_at);
  }
  const t = visit.scheduled_time ? String(visit.scheduled_time).slice(0, 5) : "";
  const day = visit.scheduled_date;
  if (day && day !== todayISO()) {
    return t ? `${formatAgendaDay(day)} · ${t}` : formatAgendaDay(day);
  }
  if (t) return t;
  return "Sin hora";
}

function metaLabel(visit: Visit, pinMissing?: boolean, showSeller?: boolean): string {
  let base = STATUS_LABEL[visit.status];
  if (visit.status === "completada") {
    if (visit.result === "sin_venta") base = "Sin venta";
    else if (visit.result) base = "Con venta";
    else base = STATUS_LABEL.completada;
    const proof = visitGpsProofLabel(visitGpsProof(visit));
    if (proof) base = `${base} · ${proof}`;
  } else if (visit.status === "en_curso") {
    base = "Toca para continuar";
  } else if (visit.status === "programada") {
    base = isVisitOverdue(visit, todayISO()) ? "Sin asistir" : "Programada";
  }
  if (showSeller && visit.seller?.full_name) {
    base = `${visit.seller.full_name} · ${base}`;
  }
  return pinMissing ? `${base} · Sin pin` : base;
}

/**
 * Fila única de visita (SF-4.3): LED/punto · PDV · hora o estado · chevron.
 * Toda la fila abre la ficha. Sin GPS, coords ni botones.
 */
export function VisitRow({ visit, onClick, index, clock, pinMissing, showSeller }: Props) {
  const name = visit.client?.name ?? `Cliente #${visit.client_id}`;
  const live = visit.status === "en_curso";
  const overdue = isVisitOverdue(visit, todayISO());
  const title = index != null ? `${index}. ${name}` : name;
  const note = visitNoteForUi(visit.description);

  return (
    <li>
      <button
        type="button"
        className={`visit-row is-${visit.status}${overdue ? " is-overdue" : ""}`}
        onClick={onClick}
      >
        <span className="visit-row-status" aria-hidden>
          {live ? (
            <LiveLed showLabel={false} />
          ) : overdue ? (
            <AlertTriangle size={14} className="visit-row-warn" />
          ) : (
            <span className={`visit-row-dot is-${visit.status}`} />
          )}
        </span>
        <span className="visit-row-copy">
          <span className="visit-row-name">{title}</span>
          <span className="visit-row-meta">{metaLabel(visit, pinMissing, showSeller)}</span>
          {note ? <span className="visit-row-note">{note}</span> : null}
        </span>
        <span className="visit-row-when">{whenLabel(visit, clock)}</span>
        <ChevronRight size={18} className="visit-row-chevron" aria-hidden />
      </button>
    </li>
  );
}
