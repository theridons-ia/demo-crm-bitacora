import { depotCity, orderDayPlan } from "./routeInsert";
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

/** Programada con fecha Caracas ya pasada (no se inició ni se canceló). */
export function isVisitOverdue(visit: Visit, today: string): boolean {
  return visit.status === "programada" && Boolean(visit.scheduled_date) && visit.scheduled_date < today;
}

/** Abiertas / agenda: en curso, luego sin asistir (más reciente primero), luego mañana → tarde. */
export function sortVisitsAgenda(list: Visit[], today?: string): Visit[] {
  return [...list].sort((a, b) => {
    if (a.status === "en_curso" && b.status !== "en_curso") return -1;
    if (b.status === "en_curso" && a.status !== "en_curso") return 1;
    if (today) {
      const ao = isVisitOverdue(a, today);
      const bo = isVisitOverdue(b, today);
      if (ao && !bo) return -1;
      if (bo && !ao) return 1;
      if (ao && bo) return scheduledStamp(b) - scheduledStamp(a);
    }
    return scheduledStamp(a) - scheduledStamp(b);
  });
}

/** Visita del plan de ese día Caracas (no historial cerrado hoy de otra fecha). */
export function isOnDayAgenda(visit: Visit, day: string): boolean {
  return visit.status !== "cancelada" && visit.scheduled_date === day;
}

/** Trazo oficial del día: hora, ciudad (base del vendedor) y luego secuencia. */
export function sortVisitsRoute(list: Visit[]): Visit[] {
  if (!list.length) return [];
  const groups = new Map<number, Visit[]>();
  for (const visit of list) {
    const arr = groups.get(visit.seller_id) ?? [];
    arr.push(visit);
    groups.set(visit.seller_id, arr);
  }
  const out: Visit[] = [];
  for (const group of groups.values()) {
    const depot = depotCity(group[0]?.seller?.route_name);
    out.push(...orderDayPlan(group, depot));
  }
  return out;
}

/** Hechas / canceladas: más reciente primero. */
export function sortVisitsHistory(list: Visit[]): Visit[] {
  return [...list].sort((a, b) => historyStamp(b) - historyStamp(a));
}
