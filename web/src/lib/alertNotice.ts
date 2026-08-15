import { formatAgendaDay, formatDateTime } from "./caracasTime";
import type { VisitAlert } from "./types";

export type RouteStopWhen = {
  dateLabel: string;
  timeLabel: string | null;
  undated: boolean;
};

function firstName(full: string): string {
  return full.trim().split(/\s+/)[0] || full;
}

function parseLegacyWhen(message: string): RouteStopWhen | null {
  const match = message.match(/^Nueva parada:\s*.+?\s*·\s*(.+)$/i);
  if (!match) return null;
  const rest = match[1].trim();
  if (/^sin día$/i.test(rest)) {
    return { dateLabel: "Sin día", timeLabel: null, undated: true };
  }
  const [datePart, timePart] = rest.split("·").map((s) => s.trim());
  if (!datePart) return null;
  if (/^sin hora$/i.test(timePart ?? "")) {
    return { dateLabel: datePart, timeLabel: null, undated: false };
  }
  return { dateLabel: datePart, timeLabel: timePart || null, undated: false };
}

/** Fecha/hora de la parada (no del aviso). */
export function routeStopWhen(alert: VisitAlert): RouteStopWhen {
  if (alert.stop_date) {
    return {
      dateLabel: formatAgendaDay(alert.stop_date),
      timeLabel: alert.stop_time ?? null,
      undated: false,
    };
  }
  const legacy = parseLegacyWhen(alert.message);
  if (legacy) return legacy;
  return { dateLabel: "Sin día", timeLabel: null, undated: true };
}

export function alertTitle(alert: VisitAlert): string {
  if (alert.alert_type === "route_assigned") {
    return alert.client_name?.trim() || "Nueva parada";
  }
  return alert.message;
}

export function alertSubline(alert: VisitAlert, forSeller: boolean): string {
  const when = formatDateTime(alert.created_at);
  if (alert.alert_type === "route_assigned") {
    const who = alert.assigned_by?.trim();
    if (who) return `Asignó ${firstName(who)} · ${when}`;
    return `Nueva parada · ${when}`;
  }
  if (forSeller) return when;
  const bits = [alert.seller_name, alert.client_name].filter(Boolean);
  return bits.length ? `${bits.join(" · ")} · ${when}` : when;
}
