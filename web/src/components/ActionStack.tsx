import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";

export type ActionStackVariant = "primary" | "outline" | "muted" | "accent";

type ActionItem = {
  key: string;
  label: string;
  icon: LucideIcon;
  variant?: ActionStackVariant;
  to?: string;
  onClick?: () => void;
  disabled?: boolean;
};

type Props = {
  items: ActionItem[];
  className?: string;
  title?: string;
};

/** Stack de CTAs full-width (hub Finanzas / acciones de módulo). */
export function ActionStack({ items, className = "", title }: Props) {
  return (
    <section className={`action-stack ${className}`.trim()} aria-label={title ?? "Acciones"}>
      {title ? <h2 className="action-stack-title">{title}</h2> : null}
      <ul className="action-stack-list">
        {items.map(({ key, label, icon: Icon, variant = "primary", to, onClick, disabled }) => {
          const cls = `action-stack-btn variant-${variant}`;
          const inner: ReactNode = (
            <>
              <Icon size={18} strokeWidth={2.2} aria-hidden />
              <span>{label}</span>
            </>
          );
          return (
            <li key={key}>
              {to && !disabled ? (
                <Link to={to} className={cls}>
                  {inner}
                </Link>
              ) : (
                <button type="button" className={cls} disabled={disabled} onClick={onClick}>
                  {inner}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
