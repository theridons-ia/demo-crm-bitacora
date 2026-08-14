import type { Visit } from "./types";

export const GPS_FAR_M = 250;

export function parseCoord(value: string | null | undefined): number | null {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export type VisitGpsProof = "full" | "partial" | "photo" | "none";

/** Prueba de que el vendedor estuvo en el PDV (inicio y/o cierre). */
export function visitGpsProof(visit: Visit): VisitGpsProof {
  if (visit.status !== "completada") return "none";
  const hasStart = parseCoord(visit.latitude) != null && parseCoord(visit.longitude) != null;
  const hasEnd = parseCoord(visit.end_latitude) != null && parseCoord(visit.end_longitude) != null;
  if (hasStart && hasEnd) return "full";
  if (hasStart || hasEnd) return "partial";
  if (visit.photo_evidence) return "photo";
  return "none";
}

export function visitGpsProofLabel(kind: VisitGpsProof): string | null {
  if (kind === "full") return "Prueba GPS";
  if (kind === "partial") return "GPS parcial";
  if (kind === "photo") return "Foto PDV";
  return null;
}
