/**
 * Evita que Cancelar en cámara/galería cierre un Modal (Escape + clic fantasma de Chrome Android).
 */

const GRACE_MS = 900;
const SAFETY_MS = 120_000;

let inPicker = false;
let armedUntil = 0;
let swallowBound = false;
let safetyTimer = 0;
let armedAt = 0;

export function shouldIgnoreOverlayClose(): boolean {
  return inPicker || Date.now() < armedUntil;
}

function swallow(event: Event) {
  if (!shouldIgnoreOverlayClose()) {
    releaseSwallow();
    return;
  }
  event.preventDefault();
  event.stopPropagation();
}

function releaseSwallow() {
  if (!swallowBound) return;
  swallowBound = false;
  document.removeEventListener("click", swallow, true);
  document.removeEventListener("pointerup", swallow, true);
}

function ensureSwallow() {
  if (swallowBound || typeof document === "undefined") return;
  swallowBound = true;
  document.addEventListener("click", swallow, true);
  document.addEventListener("pointerup", swallow, true);
}

/** Llamar al abrir el input file (antes de que el OS muestre cámara/galería). */
export function armFilePickerGuard(): void {
  inPicker = true;
  armedAt = Date.now();
  if (typeof window === "undefined") return;
  window.clearTimeout(safetyTimer);
  safetyTimer = window.setTimeout(() => settleFilePickerGuard(true), SAFETY_MS);
}

/** Llamar al volver del picker (change, focus, visibility). */
export function settleFilePickerGuard(force = false): void {
  if (!inPicker) return;
  if (!force && Date.now() - armedAt < 400) return;
  inPicker = false;
  armedUntil = Date.now() + GRACE_MS;
  if (typeof window === "undefined") return;
  window.clearTimeout(safetyTimer);
  ensureSwallow();
  window.setTimeout(() => {
    if (!shouldIgnoreOverlayClose()) releaseSwallow();
  }, GRACE_MS + 50);
}
