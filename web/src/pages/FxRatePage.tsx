import { DollarSign } from "lucide-react";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Button } from "../components/Button";
import { TextField } from "../components/TextField";
import { WorkspacePage } from "../layout/WorkspacePage";
import { ApiError, fetchFxRates, fetchFxToday, upsertFxRate, type FxRate } from "../lib/api";

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** SF-3.3 — tasa USD→VES del día (supervisor). */
export function FxRatePage() {
  const [today, setToday] = useState<FxRate | null>(null);
  const [history, setHistory] = useState<FxRate[]>([]);
  const [rateDate, setRateDate] = useState(todayISO);
  const [usdToVes, setUsdToVes] = useState("36.50");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [okNote, setOkNote] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [list, current] = await Promise.all([
        fetchFxRates(),
        fetchFxToday().catch(() => null),
      ]);
      setHistory(list);
      setToday(current);
      if (current) {
        setUsdToVes(String(Number(current.usd_to_ves)));
        setRateDate(current.rate_date);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo cargar FX");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const value = Number(usdToVes);
    if (!Number.isFinite(value) || value <= 0) {
      setError("Tasa inválida");
      return;
    }
    setBusy(true);
    setError(null);
    setOkNote(null);
    try {
      const saved = await upsertFxRate({
        rate_date: rateDate,
        usd_to_ves: value,
        notes: notes.trim() || null,
      });
      setOkNote(`Tasa guardada: 1 USD = ${Number(saved.usd_to_ves).toFixed(4)} Bs (${saved.rate_date})`);
      setNotes("");
      await reload();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo guardar");
    } finally {
      setBusy(false);
    }
  }

  return (
    <WorkspacePage
      eyebrow="Finanzas"
      title="FX"
      blurb="Carga y consulta la tasa USD→VES del día."
    >
      <header className="page-header page-header-stack">
        <div>
          <p className="eyebrow">Supervisor · finanzas</p>
          <h1 className="display-title">Tasa del día.</h1>
          <p className="muted">USD → VES (Bs). Se usa al liquidar ventas en bolívares.</p>
        </div>
      </header>

      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}
      {okNote ? <p className="offline-banner is-online">{okNote}</p> : null}

      <section className="card pulse-card" style={{ marginBottom: "0.85rem" }}>
        <p className="eyebrow" style={{ color: "rgba(246,242,235,0.75)" }}>
          Vigente
        </p>
        {loading ? (
          <p className="pulse-meta">Cargando…</p>
        ) : today ? (
          <>
            <h2 className="pulse-title">
              1 USD = {Number(today.usd_to_ves).toLocaleString("es-VE", { maximumFractionDigits: 4 })} Bs
            </h2>
            <p className="pulse-meta">
              Fecha tasa {today.rate_date}
              {today.created_by_name ? ` · ${today.created_by_name}` : ""}
            </p>
          </>
        ) : (
          <h2 className="pulse-title">Sin tasa cargada</h2>
        )}
      </section>

      <section className="card seller-panel">
        <div className="seller-panel-head">
          <h2 className="section-heading">Cargar / actualizar</h2>
          <DollarSign size={20} aria-hidden />
        </div>
        <form className="route-assign-form" onSubmit={onSubmit}>
          <TextField
            id="fx-date"
            label="Fecha"
            type="date"
            value={rateDate}
            onChange={(e) => setRateDate(e.target.value)}
            required
          />
          <TextField
            id="fx-rate"
            label="Bs por 1 USD"
            type="number"
            step="0.0001"
            value={usdToVes}
            onChange={(e) => setUsdToVes(e.target.value)}
            required
          />
          <TextField
            id="fx-notes"
            label="Nota"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="BCV, paralelo, etc."
          />
          <Button type="submit" variant="accent" block disabled={busy}>
            Guardar tasa
          </Button>
        </form>
      </section>

      <section className="card seller-panel" style={{ marginTop: "0.85rem" }}>
        <h2 className="section-heading">Historial</h2>
        {history.length === 0 ? (
          <p className="muted">Aún no hay tasas.</p>
        ) : (
          <ul className="upcoming-list">
            {history.map((r) => (
              <li key={r.id} className="upcoming-item">
                <span className="upcoming-dot status-dot-completada" aria-hidden />
                <div>
                  <p className="upcoming-name">
                    {r.rate_date} · {Number(r.usd_to_ves).toFixed(4)} Bs/USD
                  </p>
                  <p className="muted small">
                    {r.notes || "Sin nota"}
                    {r.created_by_name ? ` · ${r.created_by_name}` : ""}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </WorkspacePage>
  );
}
