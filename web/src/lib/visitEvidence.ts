import { coordsFromClient, distanceMeters } from "./gps";
import type { Visit } from "./types";

/** Alerta en vivo (¿estás lejos del PDV?). No es la nota de prueba. */
export const GPS_FAR_M = 250;

/** Inicio y cierre ≤ 40 m del PDV → prueba fiable. */
export const GPS_PROOF_OK_M = 40;
/** Peor punto 40–100 m → parcial; > 100 m o GPS incompleto → deficiente. */
export const GPS_PROOF_PARTIAL_M = 100;
/** «¿Estás aquí?»: más de 100 m del PDV pide confirmación para seguir. */
export const GPS_HERE_WARN_M = GPS_PROOF_PARTIAL_M;

/** Distancia para el mapa «lejos del PDV»: metros cerca, km si ya es un tramo. */
export function formatGapDistance(meters: number): string {
  if (!(meters >= 0) || !Number.isFinite(meters)) return "—";
  if (meters < 1000) return `${Math.round(meters)}\u00a0m`;
  return `${(meters / 1000).toLocaleString("es-VE", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })}\u00a0km`;
}

export function parseCoord(value: string | null | undefined): number | null {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export type VisitGpsProof = "fiable" | "parcial" | "deficiente" | "photo" | "none";

function pair(
  lat: string | null | undefined,
  lng: string | null | undefined,
): { lat: number; lng: number } | null {
  const a = parseCoord(lat);
  const b = parseCoord(lng);
  if (a == null || b == null) return null;
  return { lat: a, lng: b };
}

function distToPdv(
  point: { lat: number; lng: number } | null,
  pdv: { latitude: number; longitude: number } | null,
): number | null {
  if (!point || !pdv) return null;
  return distanceMeters(point.lat, point.lng, pdv.latitude, pdv.longitude);
}

function bandFromWorst(worst: number): Exclude<VisitGpsProof, "photo" | "none"> {
  if (worst <= GPS_PROOF_OK_M) return "fiable";
  if (worst <= GPS_PROOF_PARTIAL_M) return "parcial";
  return "deficiente";
}

/** Distancia del peor punto (inicio/cierre) al PDV, si hay coords. */
export function visitGpsWorstPdvM(visit: Visit): number | null {
  const pdv = coordsFromClient(visit.client);
  if (!pdv) return null;
  const start = pair(visit.latitude, visit.longitude);
  const end = pair(visit.end_latitude, visit.end_longitude);
  const dists = [distToPdv(start, pdv), distToPdv(end, pdv)].filter(
    (n): n is number => n != null,
  );
  if (!dists.length) return null;
  return Math.max(...dists);
}

/**
 * Nota de prueba al cerrar: ambos puntos vs el pin del PDV.
 * Fiable solo si hay inicio y cierre y el peor está a ≤ 40 m.
 */
export function visitGpsProof(visit: Visit): VisitGpsProof {
  if (visit.status !== "completada") return "none";
  const start = pair(visit.latitude, visit.longitude);
  const end = pair(visit.end_latitude, visit.end_longitude);
  if (!start && !end) {
    return visit.photo_evidence ? "photo" : "none";
  }
  const pdv = coordsFromClient(visit.client);
  if (!pdv) {
    return start && end ? "parcial" : "deficiente";
  }
  const startM = distToPdv(start, pdv);
  const endM = distToPdv(end, pdv);
  if (startM == null || endM == null) {
    const only = startM ?? endM;
    if (only == null) return "deficiente";
    return only > GPS_PROOF_PARTIAL_M ? "deficiente" : "parcial";
  }
  return bandFromWorst(Math.max(startM, endM));
}

export function visitGpsProofLabel(kind: VisitGpsProof): string | null {
  if (kind === "fiable") return "En el PDV";
  if (kind === "parcial") return "Dudosa";
  if (kind === "deficiente") return "Sin evidencia";
  if (kind === "photo") return "Foto PDV";
  return null;
}

export function visitGpsProofDetail(kind: VisitGpsProof): string | null {
  if (kind === "fiable") return "Presencia en el PDV: inicio y cierre a menos de 40 m";
  if (kind === "parcial") return "Presencia dudosa: GPS entre 40 y 100 m, o incompleto";
  if (kind === "deficiente") return "Sin evidencia de presencia: más de 100 m del PDV, o faltó un punto GPS";
  if (kind === "photo") return "Sin GPS; quedó la foto del PDV";
  return null;
}

/** Texto de ayuda (leyenda / tooltip) en lenguaje de campo. */
export function visitGpsProofHint(kind: VisitGpsProof): string | null {
  if (kind === "fiable") return "Estuvo en el local al iniciar y al cerrar (menos de 40 m).";
  if (kind === "parcial") return "No queda claro: entre 40 y 100 m del PDV, o el GPS está incompleto.";
  if (kind === "deficiente") return "La visita culminó, pero no se pudo acreditar la presencia (más de 100 m o faltó un punto).";
  if (kind === "photo") return "No hay GPS; quedó la foto del local.";
  return null;
}

export function visitHasSale(visit: Visit): boolean {
  if (visit.result === "venta_cerrada" || visit.result === "venta_parcial") return true;
  return visit.sale != null;
}
