import { useEffect } from "react";
import { shouldIgnoreOverlayClose } from "../lib/overlayGuard";

/** Bloquea scroll del body mientras un overlay está abierto. */
export function useBodyScrollLock(locked: boolean) {
  useEffect(() => {
    if (!locked) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.body.classList.add("has-overlay");
    return () => {
      document.body.style.overflow = prev;
      document.body.classList.remove("has-overlay");
    };
  }, [locked]);
}

const overlayStack: Array<() => void> = [];

/**
 * Escape cierra solo el overlay de encima.
 * Ignora Escape mientras hay cámara/galería nativa (ver overlayGuard).
 */
export function useEscapeKey(open: boolean, onClose: () => void) {
  useEffect(() => {
    if (!open) return;
    overlayStack.push(onClose);
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (shouldIgnoreOverlayClose()) {
        e.preventDefault();
        e.stopImmediatePropagation();
        return;
      }
      if (overlayStack[overlayStack.length - 1] !== onClose) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      const idx = overlayStack.lastIndexOf(onClose);
      if (idx >= 0) overlayStack.splice(idx, 1);
    };
  }, [open, onClose]);
}
