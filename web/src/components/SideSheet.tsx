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
};

/**
 * Side sheet — acciones cortas (derecha en desktop, hoja en móvil).
 * Portal a body + z-index alto (por encima de Leaflet).
 */
export function SideSheet({ open, onClose, title, eyebrow, blurb, children, footer }: Props) {
  useBodyScrollLock(open);
  useEscapeKey(open, onClose);
  const titleId = useId();

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div className="side-sheet" role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <button type="button" className="app-overlay-backdrop" aria-label="Cerrar" onClick={onClose} />
      <div className="side-sheet-panel">
        <div className="side-sheet-handle" aria-hidden />
        <header className="side-sheet-head">
          <div className="side-sheet-head-copy">
            {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
            <h2 id={titleId} className="side-sheet-title">
              {title}
            </h2>
            {blurb ? <p className="side-sheet-blurb">{blurb}</p> : null}
          </div>
          <Button type="button" variant="ghost" onClick={onClose} aria-label="Cerrar">
            <X size={18} />
          </Button>
        </header>
        <div className="side-sheet-body">
          <div className="side-sheet-main sheet-form">{children}</div>
        </div>
        {footer ? <footer className="side-sheet-footer">{footer}</footer> : null}
      </div>
    </div>,
    document.body,
  );
}

type StepProps = {
  step: string;
  title: string;
  blurb?: string;
  children: ReactNode;
};

/** Bloque numerado estándar (Modal o SideSheet). */
export function FormStep({ step, title, blurb, children }: StepProps) {
  return (
    <section className="form-step">
      <header className="form-step-head">
        <span className="form-step-num" aria-hidden>
          {step}
        </span>
        <div>
          <h3 className="form-step-title">{title}</h3>
          {blurb ? <p className="muted small">{blurb}</p> : null}
        </div>
      </header>
      <div className="form-step-body">{children}</div>
    </section>
  );
}
