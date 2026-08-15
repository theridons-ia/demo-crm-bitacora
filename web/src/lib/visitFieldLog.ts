/** Bitácora de visita: sobrevive si se cierra la ficha o parpadea la app. */

const PREFIX = "enrutas.visit-log.";

export type VisitLogDraft = {
  text: string;
  savedAt: number;
};

function storageKey(visitId: number, localUuid?: string | null): string {
  if (localUuid) return `${PREFIX}uuid.${localUuid}`;
  return `${PREFIX}id.${visitId}`;
}

function readKey(key: string): VisitLogDraft | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const data = JSON.parse(raw) as VisitLogDraft;
    if (typeof data?.text !== "string") return null;
    return { text: data.text, savedAt: Number(data.savedAt) || 0 };
  } catch {
    return null;
  }
}

export function readVisitLog(visitId: number, localUuid?: string | null): VisitLogDraft | null {
  const byUuid = localUuid ? readKey(storageKey(0, localUuid)) : null;
  const byId = visitId > 0 ? readKey(storageKey(visitId)) : null;
  if (byUuid && byId) return byUuid.savedAt >= byId.savedAt ? byUuid : byId;
  return byUuid ?? byId;
}

export function writeVisitLog(
  visitId: number,
  text: string,
  localUuid?: string | null,
): VisitLogDraft {
  const draft: VisitLogDraft = { text, savedAt: Date.now() };
  try {
    const payload = JSON.stringify(draft);
    if (localUuid) localStorage.setItem(storageKey(0, localUuid), payload);
    if (visitId > 0) localStorage.setItem(storageKey(visitId), payload);
  } catch {
    /* cuota / privado */
  }
  return draft;
}

export function clearVisitLog(visitId: number, localUuid?: string | null): void {
  try {
    if (localUuid) localStorage.removeItem(storageKey(0, localUuid));
    if (visitId > 0) localStorage.removeItem(storageKey(visitId));
  } catch {
    /* ignore */
  }
}

/** Líneas de bitácora: una por renglón, sin viñetas duplicadas. */
export function visitLogLines(text: string | null | undefined): string[] {
  if (!text?.trim()) return [];
  return text
    .split(/\n+/)
    .map((line) => line.replace(/^\s*[•\-\*]\s*/, "").trim())
    .filter(Boolean);
}

/** Local gana si hay texto (no perder lo que se está escribiendo en el teléfono). */
export function resolveVisitLog(
  visitId: number,
  serverNotes: string | null | undefined,
  localUuid?: string | null,
): string {
  const local = readVisitLog(visitId, localUuid);
  const server = serverNotes ?? "";
  if (!local) return server;
  if (!server) return local.text;
  if (local.text === server) return server;
  return local.text;
}
