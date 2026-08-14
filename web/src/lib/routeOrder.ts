/** Utilidades de orden de ruta (vecino más cercano). */

export type LatLng = { lat: number; lng: number };

export function haversineKm(a: LatLng, b: LatLng): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Ordena paradas desde `start` por vecino más cercano (greedy). */
export function orderByNearest<T>(
  items: T[],
  getCoords: (item: T) => LatLng | null,
  start: LatLng,
): T[] {
  const remaining = [...items];
  const ordered: T[] = [];
  let current = start;

  while (remaining.length) {
    let bestIdx = 0;
    let bestDist = Infinity;
    for (let i = 0; i < remaining.length; i++) {
      const c = getCoords(remaining[i]);
      if (!c) {
        if (bestDist === Infinity) bestIdx = i;
        continue;
      }
      const d = haversineKm(current, c);
      if (d < bestDist) {
        bestDist = d;
        bestIdx = i;
      }
    }
    const next = remaining.splice(bestIdx, 1)[0];
    ordered.push(next);
    const nc = getCoords(next);
    if (nc) current = nc;
  }
  return ordered;
}

/**
 * Recorrido greedy (vecino más cercano). No es el trazo oficial.
 * El mapa del día usa `sortVisitsRoute` (`scheduled_time` ASC).
 */
export function orderDayRoute<T>(
  items: T[],
  getCoords: (item: T) => LatLng | null,
  isDone: (item: T) => boolean,
  start: LatLng,
): T[] {
  const done = items.filter(isDone);
  const pending = items.filter((item) => !isDone(item));
  const doneOrdered = orderByNearest(done, getCoords, start);
  const lastDone = doneOrdered.length ? getCoords(doneOrdered[doneOrdered.length - 1]) : null;
  const pendingStart = lastDone ?? start;
  const pendingOrdered = orderByNearest(pending, getCoords, pendingStart);
  return [...doneOrdered, ...pendingOrdered];
}
