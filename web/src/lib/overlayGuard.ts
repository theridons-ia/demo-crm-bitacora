/**
 * Evita que cámara/galería nativa cierren el Modal.
 *
 * Android Chrome dispara un clic fantasma al volver. El guard dura todo el
 * tiempo que el usuario está en la app de cámara y un margen al regresar.
 */

const RETURN_GRACE_MS = 1800;
const AFTER_GRACE_MS = 2000;
const OPEN_BLIP_MS = 1200;
const SAFETY_MS = 120_000;

let inPicker = false;
let leftForPicker = false;
let armedUntil = 0;
let armedAt = 0;
let graceTimer = 0;
let safetyTimer = 0;
let swallowBound = false;
let lifeBound = false;

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

function onPageHide() {
  if (!inPicker) return;
  leftForPicker = true;
}

function onPageShow() {
  if (!inPicker) return;
  if (!leftForPicker && Date.now() - armedAt < OPEN_BLIP_MS) return;
  beginReturnGrace();
}

function bindLifecycle() {
  if (lifeBound || typeof window === "undefined") return;
  lifeBound = true;
  window.addEventListener("pagehide", onPageHide);
  window.addEventListener("blur", onPageHide);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") onPageHide();
    else onPageShow();
  });
  window.addEventListener("focus", onPageShow);
  window.addEventListener("pageshow", onPageShow);
}

function beginReturnGrace() {
  if (typeof window === "undefined") {
    finishGuard();
    return;
  }
  window.clearTimeout(graceTimer);
  graceTimer = window.setTimeout(() => finishGuard(), RETURN_GRACE_MS);
}

function finishGuard() {
  inPicker = false;
  leftForPicker = false;
  armedUntil = Date.now() + AFTER_GRACE_MS;
  if (typeof window === "undefined") return;
  window.clearTimeout(graceTimer);
  window.clearTimeout(safetyTimer);
  ensureSwallow();
  window.setTimeout(() => {
    if (!shouldIgnoreOverlayClose()) releaseSwallow();
  }, AFTER_GRACE_MS + 50);
}

/** Llamar al abrir el input file / cámara nativa. */
export function armFilePickerGuard(): void {
  inPicker = true;
  leftForPicker = false;
  armedAt = Date.now();
  armedUntil = 0;
  bindLifecycle();
  if (typeof window === "undefined") return;
  window.clearTimeout(graceTimer);
  window.clearTimeout(safetyTimer);
  safetyTimer = window.setTimeout(() => finishGuard(), SAFETY_MS);
}

/** Mantener el guard mientras se comprime la foto. */
export function holdFilePickerGuard(): void {
  inPicker = true;
  if (typeof window !== "undefined") window.clearTimeout(graceTimer);
}

/** Llamar al volver del picker (change). `force` = ya hay archivo o cancelaron. */
export function settleFilePickerGuard(force = false): void {
  if (!inPicker && Date.now() >= armedUntil) return;
  if (force) {
    beginReturnGrace();
    return;
  }
  onPageShow();
}
