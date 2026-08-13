import { ChevronRight } from "lucide-react";
import { LiveLed } from "./LiveLed";
import { formatAgendaDay, formatTime, todayISO } from "../lib/caracasTime";
import type { Visit, VisitStatus } from "../lib/types";

const STATUS_LABEL: Record<VisitStatus, string> = {
  programada: "Programada",
  en_curso: "En curso",
  completada: "Cerrada",
  cancelada: "Cancelada",
};

type Props = {
  visit: Visit;
  onClick: () => void;
  /** Número de parada (mapa / orden del día). */
  index?: number;
};

function whenLabel(visit: Visit): string {
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

function metaLabel(visit: Visit): string {
  if (visit.status === "completada") {
    if (visit.result === "sin_venta") return "Sin venta";
    if (visit.result) return "Con venta";
    return STATUS_LABEL.completada;
  }
  if (visit.status === "en_curso") return "Toca para continuar";
  if (visit.status === "programada") return "Programada";
  return STATUS_LABEL[visit.status];
}

/**
 * Fila única de visita (SF-4.3): LED/punto · PDV · hora o estado · chevron.
 * Toda la fila abre la ficha. Sin GPS, coords ni botones.
 */
export function VisitRow({ visit, onClick, index }: Props) {
  const name = visit.client?.name ?? `Cliente #${visit.client_id}`;
  const live = visit.status === "en_curso";
  const title = index != null ? `${index}. ${name}` : name;

  return (
    <li>
      <button type="button" className={`visit-row is-${visit.status}`} onClick={onClick}>
        <span className="visit-row-status" aria-hidden>
          {live ? (
            <LiveLed showLabel={false} />
          ) : (
            <span className={`visit-row-dot is-${visit.status}`} />
          )}
        </span>
        <span className="visit-row-copy">
          <span className="visit-row-name">{title}</span>
          <span className="visit-row-meta">{metaLabel(visit)}</span>
        </span>
        <span className="visit-row-when">{whenLabel(visit)}</span>
        <ChevronRight size={18} className="visit-row-chevron" aria-hidden />
      </button>
    </li>
  );
}
