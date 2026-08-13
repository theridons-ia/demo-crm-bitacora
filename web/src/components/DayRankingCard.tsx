import { ArrowUpRight } from "lucide-react";
import { Link } from "react-router-dom";

export type RankingRow = {
  id: number;
  name: string;
  initials: string;
  routeName: string | null;
  total: number;
  done: number;
  pct: number;
};

type Props = {
  rows: RankingRow[];
  detailTo?: string;
  title?: string;
  emptyMessage?: string;
};

function initialsFrom(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

export function rankingInitials(name: string, fallback?: string | null): string {
  return (fallback && fallback.trim()) || initialsFrom(name);
}

/** Ranking del día — avatar + barra de cobertura (panel supervisor). */
export function DayRankingCard({
  rows,
  detailTo = "/sup/vendedores",
  title = "Ranking del día",
  emptyMessage = "Sin visitas asignadas hoy.",
}: Props) {
  return (
    <section className="card ranking-card">
      <div className="ranking-card-head">
        <div>
          <p className="eyebrow">Rendimiento</p>
          <h2 className="ranking-card-title">{title}</h2>
        </div>
        <Link to={detailTo} className="link-accent ranking-detail-link">
          Ver detalle
          <ArrowUpRight size={14} aria-hidden />
        </Link>
      </div>

      {rows.length === 0 ? (
        <p className="muted">{emptyMessage}</p>
      ) : (
        <ul className="ranking-list">
          {rows.map((row) => (
            <li key={row.id} className="ranking-row">
              <div className="ranking-row-top">
                <span className="ranking-avatar" aria-hidden>
                  {row.initials}
                </span>
                <div className="ranking-row-copy">
                  <strong>{row.name}</strong>
                  <span>
                    {row.routeName ?? "Sin ruta"} · {row.total} visita
                    {row.total === 1 ? "" : "s"}
                  </span>
                </div>
                <div className="ranking-row-metrics">
                  <strong>
                    {row.done}/{row.total}
                  </strong>
                  <span>{row.pct}%</span>
                </div>
              </div>
              <div className="bar-track ranking-bar" aria-hidden>
                <div className="bar-fill dark" style={{ width: `${Math.min(100, row.pct)}%` }} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
