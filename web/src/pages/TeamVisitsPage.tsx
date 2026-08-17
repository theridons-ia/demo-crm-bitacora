import { Search } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { GpsProofLegend } from "../components/GpsProofLegend";
import { ListSearch } from "../components/ListSearch";
import { ListSkeleton } from "../components/ListSkeleton";
import { SelectField } from "../components/TextField";
import { VisitDetailSheet } from "../components/VisitDetailSheet";
import { VisitRow } from "../components/VisitRow";
import { WorkspacePage } from "../layout/WorkspacePage";
import { ApiError, fetchSellers, fetchVisits } from "../lib/api";
import { todayISO } from "../lib/caracasTime";
import { visitGpsProof, visitHasSale } from "../lib/visitEvidence";
import { sortVisitsAgenda, sortVisitsHistory } from "../lib/visitOrder";
import type { User, Visit } from "../lib/types";

type VisitFilter = "open" | "done" | "cancelada";
type ProofFilter = "all" | "fiable" | "parcial" | "deficiente" | "con_venta";

const FILTER_CHIPS: { key: VisitFilter; label: string }[] = [
  { key: "open", label: "Programadas" },
  { key: "done", label: "Culminadas" },
  { key: "cancelada", label: "Canceladas" },
];

const PROOF_CHIPS: { key: ProofFilter; label: string }[] = [
  { key: "all", label: "Todas" },
  { key: "fiable", label: "En el PDV" },
  { key: "parcial", label: "Dudosa" },
  { key: "deficiente", label: "Sin evidencia" },
  { key: "con_venta", label: "Con venta" },
];

/** Bitácora del equipo: misma fila que el vendedor. Default = programadas. */
export function TeamVisitsPage() {
  const [visits, setVisits] = useState<Visit[]>([]);
  const [sellers, setSellers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<VisitFilter>("open");
  const [proofFilter, setProofFilter] = useState<ProofFilter>("all");
  const [sellerId, setSellerId] = useState<number | "all">("all");
  const [detailVisit, setDetailVisit] = useState<Visit | null>(null);
  const today = todayISO();

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

  const withSeller = useMemo(() => {
    return visits.map((v) => ({
      ...v,
      seller: v.seller ?? sellers.find((s) => s.id === v.seller_id) ?? v.seller,
    }));
  }, [visits, sellers]);

  const counts = useMemo(() => {
    const open = withSeller.filter((v) => v.status === "programada" || v.status === "en_curso").length;
    const done = withSeller.filter((v) => v.status === "completada").length;
    const cancelled = withSeller.filter((v) => v.status === "cancelada").length;
    return { open, done, cancelled };
  }, [withSeller]);

  const donePool = useMemo(
    () => withSeller.filter((v) => v.status === "completada"),
    [withSeller],
  );

  const proofCounts = useMemo(() => {
    let fiable = 0;
    let parcial = 0;
    let deficiente = 0;
    let conVenta = 0;
    for (const v of donePool) {
      const proof = visitGpsProof(v);
      if (proof === "fiable") fiable += 1;
      else if (proof === "parcial") parcial += 1;
      else deficiente += 1;
      if (visitHasSale(v)) conVenta += 1;
    }
    return { fiable, parcial, deficiente, conVenta, all: donePool.length };
  }, [donePool]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const pool = withSeller.filter((v) => {
      if (filter === "open") return v.status === "programada" || v.status === "en_curso";
      if (filter === "done") {
        if (v.status !== "completada") return false;
        if (proofFilter === "con_venta") return visitHasSale(v);
        if (proofFilter === "fiable") return visitGpsProof(v) === "fiable";
        if (proofFilter === "parcial") return visitGpsProof(v) === "parcial";
        if (proofFilter === "deficiente") {
          const proof = visitGpsProof(v);
          return proof === "deficiente" || proof === "photo" || proof === "none";
        }
        return true;
      }
      return v.status === "cancelada";
    });
    const matched = q
      ? pool.filter((v) => {
          const seller = v.seller?.full_name ?? "";
          const client = v.client?.name ?? "";
          const id = v.client?.rif ?? v.client?.ci ?? "";
          return `${client} ${id} ${seller} ${v.description ?? ""}`.toLowerCase().includes(q);
        })
      : pool;
    return filter === "open" ? sortVisitsAgenda(matched, today) : sortVisitsHistory(matched);
  }, [withSeller, query, filter, proofFilter, today]);

  function setStatusFilter(next: VisitFilter) {
    setFilter(next);
    if (next !== "done") setProofFilter("all");
  }

  const proofChipCount = (key: ProofFilter) => {
    if (key === "all") return proofCounts.all;
    if (key === "fiable") return proofCounts.fiable;
    if (key === "parcial") return proofCounts.parcial;
    if (key === "deficiente") return proofCounts.deficiente;
    return proofCounts.conVenta;
  };

  return (
    <WorkspacePage eyebrow="Equipo" title="Visitas" blurb="Bitácora del equipo.">
      <header className="page-header">
        <div>
          <p className="eyebrow">Equipo · bitácora</p>
          <h1 className="display-title">Visitas</h1>
          <p className="muted">
            {counts.open} programadas · {counts.done} culminadas · {counts.cancelled} canceladas
          </p>
        </div>
      </header>

      <div className="list-tools-row">
        <ListSearch
          id="team-visits-search"
          value={query}
          onChange={setQuery}
          placeholder="Cliente, RIF o vendedor…"
        />
        <SelectField
          id="team-visits-seller"
          label="Vendedor"
          value={sellerId === "all" ? "all" : String(sellerId)}
          onChange={(e) => setSellerId(e.target.value === "all" ? "all" : Number(e.target.value))}
        >
          <option value="all">Todo el equipo</option>
          {sellers.map((s) => (
            <option key={s.id} value={s.id}>
              {s.full_name}
              {s.route_name ? ` · ${s.route_name}` : ""}
            </option>
          ))}
        </SelectField>
      </div>

      <div className="chips-row" role="tablist" aria-label="Filtros">
        {FILTER_CHIPS.map(({ key, label }) => {
          const count = key === "open" ? counts.open : key === "done" ? counts.done : counts.cancelled;
          return (
            <button
              key={key}
              type="button"
              className={filter === key ? "chip chip-filter active" : "chip"}
              role="tab"
              aria-selected={filter === key}
              aria-label={`${label}, ${count}`}
              onClick={() => setStatusFilter(key)}
            >
              <span className="chip-label">{label}</span>
              <span className="chip-count">{count}</span>
            </button>
          );
        })}
      </div>

      {filter === "done" ? (
        <>
          <GpsProofLegend
            counts={{
              fiable: proofCounts.fiable,
              parcial: proofCounts.parcial,
              deficiente: proofCounts.deficiente,
            }}
          />
          <div className="chips-row is-proof" role="tablist" aria-label="Prueba GPS">
            {PROOF_CHIPS.map(({ key, label }) => {
              const count = proofChipCount(key);
              return (
                <button
                  key={key}
                  type="button"
                  className={proofFilter === key ? `chip chip-filter active is-proof-${key}` : "chip chip-filter"}
                  role="tab"
                  aria-selected={proofFilter === key}
                  aria-label={`${label}, ${count}`}
                  onClick={() => setProofFilter(key)}
                >
                  <span className="chip-label">{label}</span>
                  <span className="chip-count">{count}</span>
                </button>
              );
            })}
          </div>
        </>
      ) : null}

      {loading ? <ListSkeleton /> : null}
      {error ? <p className="form-error">{error}</p> : null}

      {!loading ? (
        <ul className="visit-row-list">
          {filtered.map((visit) => (
            <VisitRow
              key={visit.id}
              visit={visit}
              showSeller={sellerId === "all"}
              clock={filter === "open" ? "agenda" : undefined}
              onClick={() => setDetailVisit(visit)}
            />
          ))}
        </ul>
      ) : null}

      {!loading && filtered.length === 0 ? (
        <p className="muted">
          <Search size={14} style={{ verticalAlign: "-2px", marginRight: 4 }} />
          Sin visitas con este filtro.
        </p>
      ) : null}

      {detailVisit ? (
        <VisitDetailSheet
          visit={detailVisit}
          open
          onClose={() => setDetailVisit(null)}
          onUpdated={(updated) => {
            setVisits((prev) => prev.map((v) => (v.id === updated.id ? updated : v)));
            setDetailVisit(updated);
          }}
        />
      ) : null}
    </WorkspacePage>
  );
}
