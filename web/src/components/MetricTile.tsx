import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export type MetricTone = "default" | "accent" | "success" | "warning" | "solid" | "solid-accent";

type MetricTileProps = {
  label: string;
  value: string | number;
  icon?: LucideIcon;
  /** Logo cuadrado (BCV, Binance). Gana sobre `icon`. */
  markSrc?: string;
  hint?: string;
  tone?: MetricTone;
  className?: string;
};

/** KPI card estilo FINA → tokens EnRutas (barra lateral + cifra). */
export function MetricTile({
  label,
  value,
  icon: Icon,
  markSrc,
  hint,
  tone = "default",
  className = "",
}: MetricTileProps) {
  return (
    <article className={`metric-tile tone-${tone} ${className}`.trim()}>
      <div className="metric-tile-top">
        <p className="metric-tile-label">{label}</p>
        {markSrc ? (
          <span className="metric-tile-icon is-mark" aria-hidden>
            <img src={markSrc} alt="" />
          </span>
        ) : Icon ? (
          <span className="metric-tile-icon" aria-hidden>
            <Icon size={16} strokeWidth={2} />
          </span>
        ) : null}
      </div>
      <strong className="metric-tile-value">{value}</strong>
      {hint ? <p className="metric-tile-hint">{hint}</p> : null}
    </article>
  );
}

type MetricGridProps = {
  children: ReactNode;
  /** 1 tile ancho completo arriba (hero). */
  hero?: ReactNode;
  className?: string;
  "aria-label"?: string;
};

export function MetricGrid({ children, hero, className = "", "aria-label": ariaLabel }: MetricGridProps) {
  return (
    <div className={`metric-grid ${className}`.trim()} aria-label={ariaLabel}>
      {hero ? <div className="metric-grid-hero">{hero}</div> : null}
      <div className="metric-grid-cells">{children}</div>
    </div>
  );
}
