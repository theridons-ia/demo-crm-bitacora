import { X } from "lucide-react";
import { useId, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Button } from "./Button";
import { useBodyScrollLock, useEscapeKey } from "../hooks/useOverlay";

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
  useBodyScrollLock(open);
  useEscapeKey(open, onClose);
  const titleId = useId();

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      className={`app-modal app-modal-${size}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <button type="button" className="app-overlay-backdrop" aria-label="Cerrar" onClick={onClose} />
      <div className="app-modal-panel">
        <header className="app-modal-head">
          <div className="app-modal-head-copy">
            {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
            <h2 id={titleId} className="app-modal-title">
              {title}
            </h2>
            {blurb ? <p className="app-modal-blurb">{blurb}</p> : null}
          </div>
          <Button type="button" variant="ghost" onClick={onClose} aria-label="Cerrar">
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
