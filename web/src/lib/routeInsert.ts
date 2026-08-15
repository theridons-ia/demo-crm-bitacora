/** Inserción de parada en el día: hora si hay, si no clúster de ciudad + base del vendedor. */

export type RoutePlace = "auto" | "start" | "end";

export type StopLike = {
  id: number;
  status: string;
  sequence?: number | null;
  scheduled_time?: string | null;
  client?: { name?: string | null; city?: string | null; state?: string | null } | null;
};

const FROZEN = new Set(["completada", "en_curso"]);

export function foldPlace(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .trim();
}

/** Primera ciudad de `route_name` («Valencia · Puerto Cabello»). */
export function depotCity(routeName: string | null | undefined): string {
  if (!routeName?.trim()) return "";
  const first = routeName.replaceAll("/", "·").split("·")[0] ?? "";
  return foldPlace(first);
}

export function stopCity(stop: StopLike): string {
  return foldPlace(stop.client?.city || stop.client?.state || "");
}

function timeMinutes(stop: StopLike): number | null {
  const raw = stop.scheduled_time ? String(stop.scheduled_time) : "";
  const m = raw.match(/^(\d{1,2}):(\d{2})/);
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

function prevOrder(a: StopLike, b: StopLike): number {
  const sa = a.sequence ?? 0;
  const sb = b.sequence ?? 0;
  if (sa !== sb) return sa - sb;
  return a.id - b.id;
}

function insertUntimed(result: StopLike[], stop: StopLike, depot: string): void {
  const city = stopCity(stop);
  const same: number[] = [];
  result.forEach((row, i) => {
    if (city && stopCity(row) === city) same.push(i);
  });
  const home = Boolean(depot && city && city === depot);
  if (same.length) {
    const at = home ? same[0] : same[same.length - 1] + 1;
    result.splice(at, 0, stop);
    return;
  }
  if (home) {
    result.splice(0, 0, stop);
    return;
  }
  result.push(stop);
}

function autoOrder(movable: StopLike[], depot: string, draftId: number): StopLike[] {
  const timed = movable
    .filter((s) => timeMinutes(s) != null)
    .sort((a, b) => (timeMinutes(a) ?? 0) - (timeMinutes(b) ?? 0) || prevOrder(a, b));
  const untimed = movable.filter((s) => timeMinutes(s) == null).sort(prevOrder);

  if (timed.length) {
    const result = [...timed];
    for (const stop of untimed) insertUntimed(result, stop, depot);
    return result;
  }

  const groups = new Map<string, StopLike[]>();
  for (const stop of untimed) {
    const key = stopCity(stop) || "_";
    const list = groups.get(key) ?? [];
    list.push(stop);
    groups.set(key, list);
  }
  const keys = [...groups.keys()].sort((a, b) => {
    const ha = a !== "_" && a === depot ? 0 : 1;
    const hb = b !== "_" && b === depot ? 0 : 1;
    if (ha !== hb) return ha - hb;
    const sa = Math.min(...(groups.get(a) ?? []).map((s) => s.sequence ?? s.id));
    const sb = Math.min(...(groups.get(b) ?? []).map((s) => s.sequence ?? s.id));
    return sa - sb;
  });
  const out: StopLike[] = [];
  for (const key of keys) {
    const list = groups.get(key) ?? [];
    const home = key !== "_" && key === depot;
    const ordered = home
      ? [...list].sort((a, b) => (a.id === draftId ? -1 : b.id === draftId ? 1 : prevOrder(a, b)))
      : list;
    out.push(...ordered);
  }
  return out;
}

/**
 * Orden del día con la parada nueva ya incluida en `stops` (id = draftId).
 * Hechas / en curso se quedan al frente. Lo programado se inserta.
 */
export function placeDayStops(
  stops: StopLike[],
  draftId: number,
  place: RoutePlace,
  depot: string,
): StopLike[] {
  const frozen = stops.filter((s) => FROZEN.has(s.status)).sort(prevOrder);
  const movable = stops.filter((s) => !FROZEN.has(s.status));
  const draft = movable.find((s) => s.id === draftId);
  const rest = movable.filter((s) => s.id !== draftId).sort(prevOrder);
  if (!draft) return orderDayPlan(stops, depot);
  if (place === "start") return [...frozen, draft, ...rest];
  if (place === "end") return [...frozen, ...rest, draft];
  return [...frozen, ...autoOrder([...rest, draft], depot, draftId)];
}

/** Trazo del día (sin parada nueva): hora, clúster de ciudad, base del vendedor. */
export function orderDayPlan<T extends StopLike>(stops: T[], depot: string): T[] {
  const frozen = stops.filter((s) => FROZEN.has(s.status)).sort(prevOrder);
  const movable = stops.filter((s) => !FROZEN.has(s.status));
  return [...frozen, ...autoOrder(movable, depot, 0)] as T[];
}

export function placePreviewNote(
  ordered: StopLike[],
  draftId: number,
): { index: number; before: string | null; text: string } | null {
  const index = ordered.findIndex((s) => s.id === draftId);
  if (index < 0) return null;
  const n = index + 1;
  const next = ordered[index + 1];
  const before = next?.client?.name?.trim() || null;
  const text = before
    ? `Quedaría ${n}.ª · antes de ${before}`
    : ordered.length === 1
      ? "Quedaría 1.ª parada del día"
      : `Quedaría ${n}.ª · última del día`;
  return { index: n, before, text };
}
