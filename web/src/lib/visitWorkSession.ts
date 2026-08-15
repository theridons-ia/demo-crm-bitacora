/** Visita/OV en curso: sobrevive navegación, recarga y cambio de pestaña. */

const KEY = "enrutas.visit-work";

export type VisitWorkSession = {
  visitId: number;
  selling: boolean;
  clientName: string;
};

const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((fn) => fn());
}

export function subscribeVisitWork(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function loadVisitWork(): VisitWorkSession | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as VisitWorkSession;
    if (!data || typeof data.visitId !== "number") return null;
    return {
      visitId: data.visitId,
      selling: Boolean(data.selling),
      clientName: typeof data.clientName === "string" ? data.clientName : "",
    };
  } catch {
    return null;
  }
}

export function saveVisitWork(work: VisitWorkSession): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(work));
  } catch {
    /* ignore */
  }
  notify();
}

export function patchVisitWork(partial: Partial<VisitWorkSession>): void {
  const current = loadVisitWork();
  if (!current) {
    if (partial.visitId == null) return;
    saveVisitWork({
      visitId: partial.visitId,
      selling: Boolean(partial.selling),
      clientName: partial.clientName ?? "",
    });
    return;
  }
  saveVisitWork({ ...current, ...partial });
}

export function clearVisitWork(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
  notify();
}
