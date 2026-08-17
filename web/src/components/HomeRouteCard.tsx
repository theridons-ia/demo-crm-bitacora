import { CheckCircle2, MapPin, Route } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";

export type HomeRouteLens = "hoy" | "semana";

type Props = {
  lens: HomeRouteLens;
  onLensChange: (lens: HomeRouteLens) => void;
  loading?: boolean;
  eyebrow: string;
  title: string;
  progressLabel: string;
  progressPct: number;
  hasStops: boolean;
  complete: boolean;
  extra?: ReactNode;
  ctaTo: string;
  ctaLabel: string;
  ctaKind?: "map" | "route";
};

/** Casilla oscura de ruta (hoy / semana) en el inicio. */
export function HomeRouteCard({
  lens,
  onLensChange,
  loading,
  eyebrow,
  title,
  progressLabel,
  progressPct,
  hasStops,
  complete,
  extra,
  ctaTo,
  ctaLabel,
  ctaKind = "map",
}: Props) {
  const showingWeek = lens === "semana";
  const CtaIcon = ctaKind === "route" ? Route : MapPin;
  const doneLabel = showingWeek ? "Ruta de la semana lista" : "Ruta del día completada";

  return (
    <section
      className={`route-card${complete && !loading ? " is-complete" : ""}`}
      aria-label={showingWeek ? "Ruta de la semana" : "Ruta de hoy"}
    >
      <div className="route-card-top">
        <div className="route-card-lenses" role="tablist" aria-label="Alcance de la ruta">
          <button
            type="button"
            role="tab"
            aria-selected={!showingWeek}
            className={!showingWeek ? "active" : undefined}
            onClick={() => onLensChange("hoy")}
          >
            Hoy
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={showingWeek}
            className={showingWeek ? "active" : undefined}
            onClick={() => onLensChange("semana")}
          >
            Semana
          </button>
        </div>
        {complete && !loading ? (
          <span className="route-card-done" title={doneLabel} aria-label={doneLabel}>
            <CheckCircle2 size={22} strokeWidth={2.4} aria-hidden />
          </span>
        ) : null}
      </div>
      <p className="label">{eyebrow}</p>
      <h2>{title}</h2>
      {loading ? null : (
        <div className="progress-track" aria-hidden>
          <div className="progress-fill" style={{ width: `${Math.min(100, progressPct)}%` }} />
        </div>
      )}
      <div className="route-meta">
        <span>{progressLabel}</span>
        {!loading && hasStops ? <strong>{progressPct}%</strong> : null}
      </div>
      {extra}
      <Link to={ctaTo} className="btn btn-accent route-map-cta">
        <CtaIcon size={18} />
        {ctaLabel}
      </Link>
    </section>
  );
}
