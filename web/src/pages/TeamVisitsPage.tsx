import {
  Calendar,
  CheckCircle2,
  ClipboardList,
  Clock,
  Search,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ListSearch } from "../components/ListSearch";
import { WorkspacePage } from "../layout/WorkspacePage";
import { ApiError, fetchSellers, fetchVisits } from "../lib/api";
import { formatDateTimeLong } from "../lib/caracasTime";
import type { User, Visit, VisitStatus } from "../lib/types";

const statusLabel: Record<VisitStatus, string> = {
  programada: "Programada",
  en_curso: "En curso",
  completada: "Completada",
  cancelada: "Cancelada",
};

type StatusFilter = "all" | VisitStatus;

function formatWhen(iso: string | null | undefined): string {
  if (!iso) return "";
  return formatDateTimeLong(iso);
}

function visitIconTone(status: VisitStatus): string {
  if (status === "en_curso") return "tone-progress";
  if (status === "programada") return "tone-accent";
  if (status === "completada") return "tone-ok";
  return "tone-muted";
}

function VisitStatusIcon({ status }: { status: VisitStatus }) {
  if (status === "en_curso") return <Clock size={16} />;
  if (status === "programada") return <Calendar size={16} />;
  if (status === "completada") return <CheckCircle2 size={16} />;
  return <ClipboardList size={16} />;
}

/** Lista de todas las visitas del equipo (supervisor). */
export function TeamVisitsPage() {
  const [visits, setVisits] = useState<Visit[]>([]);
  const [sellers, setSellers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [sellerId, setSellerId] = useState<number | "all">("all");

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [v, s] = await Promise.all([
        fetchVisits(sellerId === "all" ? undefined : { seller_id: sellerId }),
        fetchSellers(),
      ]);
      setVisits(v);
      setSellers(s);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudieron cargar las visitas");
    } finally {
      setLoading(false);
    }
  }, [sellerId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return visits.filter((v) => {
      if (status !== "all" && v.status !== status) return false;
      if (!q) return true;
      const seller = v.seller?.full_name ?? "";
      const client = v.client?.name ?? "";
      const id = v.client?.rif ?? v.client?.ci ?? "";
      return `${client} ${id} ${seller} ${v.description ?? ""}`.toLowerCase().includes(q);
    });
  }, [visits, query, status]);

  const counts = useMemo(() => {
    const open = visits.filter((v) => v.status === "programada" || v.status === "en_curso").length;
    const done = visits.filter((v) => v.status === "completada").length;
    return { open, done, total: visits.length };
  }, [visits]);

  return (
    <WorkspacePage
      eyebrow="Equipo"
      title="Visitas"
      blurb="Todas las visitas del equipo, con filtro por vendedor y estado."
      asideExtra={
        <section className="card chart-card">
          <h2>Resumen</h2>
          <div className="bar-list">
            <div>
              <div className="bar-item-top">
                <span>Programadas</span>
                <strong>{counts.open}</strong>
              </div>
              <div className="bar-track" aria-hidden>
                <div
                  className="bar-fill accent"
                  style={{
                    width: counts.total ? `${Math.round((counts.open / counts.total) * 100)}%` : "0%",
                  }}
                />
              </div>
            </div>
            <div>
              <div className="bar-item-top">
                <span>Culminadas</span>
                <strong>{counts.done}</strong>
              </div>
              <div className="bar-track" aria-hidden>
                <div
                  className="bar-fill dark"
                  style={{
                    width: counts.total ? `${Math.round((counts.done / counts.total) * 100)}%` : "0%",
                  }}
                />
              </div>
            </div>
          </div>
        </section>
      }
    >
      <header className="page-header page-header-stack">
        <div>
          <p className="eyebrow">Equipo · bitácora</p>
          <h1 className="display-title">Visitas</h1>
          <p className="muted">{counts.total} visitas · {counts.open} abiertas</p>
        </div>
      </header>

      <div className="list-page-tools">
        <ListSearch
          id="team-visits-search"
          value={query}
          onChange={setQuery}
          placeholder="Cliente, RIF o vendedor…"
        />

        <label className="field" htmlFor="team-visits-seller">
          <span className="field-label">Vendedor</span>
          <select
            id="team-visits-seller"
            className="input"
            value={sellerId === "all" ? "all" : String(sellerId)}
            onChange={(e) =>
              setSellerId(e.target.value === "all" ? "all" : Number(e.target.value))
            }
          >
            <option value="all">Todo el equipo</option>
            {sellers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.full_name}
                {s.route_name ? ` · ${s.route_name}` : ""}
              </option>
            ))}
          </select>
        </label>

        <div className="filter-chips" role="tablist" aria-label="Estado">
          {(
            [
              ["all", "Todas"],
              ["programada", "Programadas"],
              ["en_curso", "En curso"],
              ["completada", "Culminadas"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={status === id ? "chip active" : "chip"}
              onClick={() => setStatus(id)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {loading ? <p className="muted">Cargando…</p> : null}
      {error ? <p className="form-error">{error}</p> : null}

      <ul className="ficha-stack">
        {filtered.map((visit) => {
          const clientName = visit.client?.name ?? `Cliente #${visit.client_id}`;
          const id = visit.client?.rif ?? visit.client?.ci ?? "";
          const sellerName = visit.seller?.full_name ?? `Vendedor #${visit.seller_id}`;
          const when =
            formatWhen(visit.visited_at) ||
            (visit.scheduled_date ? `Prog. ${visit.scheduled_date}` : formatWhen(visit.created_at));
          return (
            <li key={visit.id}>
              <article className="ficha">
                <span className={`ficha-icon ${visitIconTone(visit.status)}`} aria-hidden>
                  <VisitStatusIcon status={visit.status} />
                </span>
                <div className="ficha-body">
                  <div className="ficha-row">
                    <h3 className="ficha-title">{clientName}</h3>
                    <span className={`badge badge-${visit.status === "en_curso" ? "progress" : visit.status === "completada" ? "success" : "accent"}`}>
                      {statusLabel[visit.status]}
                    </span>
                  </div>
                  <p className="ficha-meta">
                    {sellerName}
                    {id ? ` · ${id}` : ""}
                  </p>
                  {visit.description ? <p className="ficha-note">{visit.description}</p> : null}
                  <p className="ficha-stats">{when}</p>
                </div>
              </article>
            </li>
          );
        })}
      </ul>

      {!loading && filtered.length === 0 ? (
        <p className="muted">
          <Search size={14} style={{ verticalAlign: "-2px", marginRight: 4 }} />
          Sin visitas con este filtro.
        </p>
      ) : null}
    </WorkspacePage>
  );
}
