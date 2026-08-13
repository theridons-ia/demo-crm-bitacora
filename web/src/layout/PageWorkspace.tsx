import type { ReactNode } from "react";

type Props = {
  children: ReactNode;
  /** Panel derecho (solo desktop ≥1100px). Omitir si no hay contenido útil. */
  aside?: ReactNode;
  /** Clase extra en main (p. ej. mapas a full). */
  mainClassName?: string;
};

/**
 * Área de trabajo: columna principal + panel derecho opcional.
 * El aside solo se muestra en desktop (≥1100px) y solo si hay contenido.
 */
export function PageWorkspace({ children, aside, mainClassName }: Props) {
  const hasAside = Boolean(aside);

  return (
    <div className={`workspace${hasAside ? " workspace-has-aside" : ""}`}>
      <div className={`workspace-main${mainClassName ? ` ${mainClassName}` : ""}`}>{children}</div>
      {hasAside ? (
        <aside className="workspace-aside" aria-label="Panel contextual">
          {aside}
        </aside>
      ) : null}
    </div>
  );
}

type HintProps = {
  eyebrow?: string;
  title: string;
  blurb: string;
  children?: ReactNode;
};

/**
 * Bloque tip para el panel derecho.
 * Usar solo con contenido real — no placeholders genéricos.
 */
export function AsideHint({ eyebrow = "Contexto", title, blurb, children }: HintProps) {
  return (
    <section className="card aside-hint">
      <p className="eyebrow">{eyebrow}</p>
      <h2 className="aside-hint-title">{title}</h2>
      <p className="muted small">{blurb}</p>
      {children}
    </section>
  );
}
