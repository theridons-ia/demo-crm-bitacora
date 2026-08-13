import type { Visit } from "./types";

/** Instante de agenda en Caracas (fecha + hora programada). */
export function scheduledStamp(visit: Visit): number {
  if (visit.scheduled_date) {
    const raw = visit.scheduled_time ? String(visit.scheduled_time) : "08:00:00";
    const t = raw.length >= 8 ? raw.slice(0, 8) : `${raw.slice(0, 5)}:00`;
    const ms = Date.parse(`${visit.scheduled_date}T${t}-04:00`);
    if (!Number.isNaN(ms)) return ms;
  }
  const fallback = Date.parse(visit.created_at);
  return Number.isNaN(fallback) ? 0 : fallback;
}

function historyStamp(visit: Visit): number {
  const ms = Date.parse(visit.visited_at || visit.created_at);
  return Number.isNaN(ms) ? 0 : ms;
}

/** Abiertas / agenda: en curso primero, luego mañana → tarde. */
export function sortVisitsAgenda(list: Visit[]): Visit[] {
  return [...list].sort((a, b) => {
    if (a.status === "en_curso" && b.status !== "en_curso") return -1;
    if (b.status === "en_curso" && a.status !== "en_curso") return 1;
    return scheduledStamp(a) - scheduledStamp(b);
  });
}

/** Hechas / canceladas: más reciente primero. */
export function sortVisitsHistory(list: Visit[]): Visit[] {
  return [...list].sort((a, b) => historyStamp(b) - historyStamp(a));
}
