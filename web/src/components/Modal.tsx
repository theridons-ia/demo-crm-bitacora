import { X } from "lucide-react";
import { useCallback, useEffect, useId, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Button } from "./Button";
import { useBodyScrollLock, useEscapeKey } from "../hooks/useOverlay";
import { shouldIgnoreOverlayClose } from "../lib/overlayGuard";

type Props = {
  open: boolean;
  onClose: () => void;
  title: string;
  eyebrow?: string;
  blurb?: string;
  children: ReactNode;
  footer?: ReactNode;
  /** Ancho del diálogo. default ≈ 720px; wide ≈ 860px. */
  size?: "default" | "wide";
};

/**
 * Modal centrado — formularios largos / fichas / mapas.
 * Portal a body + z-index alto (por encima de Leaflet).
 */
export function Modal({
  open,
  onClose,
  title,
  eyebrow,
  blurb,
  children,
  footer,
  size = "default",
}: Props) {
  const close = useCallback(() => {
    if (shouldIgnoreOverlayClose()) return;
    onClose();
  }, [onClose]);
  useBodyScrollLock(open);
  useEscapeKey(open, close);
  const titleId = useId();
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const el = rootRef.current;
    if (!el) return;

    const syncViewport = () => {
      const vv = window.visualViewport;
      if (!vv) {
        el.style.removeProperty("--vv-top");
        el.style.removeProperty("--vv-height");
        return;
      }
      el.style.setProperty("--vv-top", `${Math.round(vv.offsetTop)}px`);
      el.style.setProperty("--vv-height", `${Math.round(vv.height)}px`);
    };

    const onFocusIn = (event: FocusEvent) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      if (!el.contains(target)) return;
      if (!target.matches("input:not([type=file]), textarea, select")) return;
      window.setTimeout(() => {
        target.scrollIntoView({ block: "center", behavior: "smooth" });
      }, 280);
    };

    syncViewport();
    window.visualViewport?.addEventListener("resize", syncViewport);
    window.visualViewport?.addEventListener("scroll", syncViewport);
    el.addEventListener("focusin", onFocusIn);
    return () => {
      window.visualViewport?.removeEventListener("resize", syncViewport);
      window.visualViewport?.removeEventListener("scroll", syncViewport);
      el.removeEventListener("focusin", onFocusIn);
    };
  }, [open]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      ref={rootRef}
      className={`app-modal app-modal-${size}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <button type="button" className="app-overlay-backdrop" aria-label="Cerrar" onClick={close} />
      <div className="app-modal-panel">
        <header className="app-modal-head">
          <div className="app-modal-head-copy">
            {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
            <h2 id={titleId} className="app-modal-title">
              {title}
            </h2>
            {blurb ? <p className="app-modal-blurb">{blurb}</p> : null}
          </div>
          <Button type="button" variant="ghost" onClick={close} aria-label="Cerrar">
            <X size={18} />
          </Button>
        </header>
        <div className="app-modal-body">{children}</div>
        {footer ? <footer className="app-modal-footer">{footer}</footer> : null}
      </div>
    </div>,
    document.body,
  );
}
