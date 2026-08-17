import { RefreshCw } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { Button } from "../components/Button";
import { MetricGrid, MetricTile } from "../components/MetricTile";
import { TextField } from "../components/TextField";
import { WorkspacePage } from "../layout/WorkspacePage";
import {
  ApiError,
  fetchFxRates,
  fetchFxToday,
  refreshFxRates,
  upsertFxRate,
  type FxRate,
} from "../lib/api";
import { formatDateTime, todayISO } from "../lib/caracasTime";

function formatBsRate(value: string | number | null | undefined): string {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return "—";
  return n.toLocaleString("es-VE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  });
}

function isLiveBcv(rate: FxRate | null): boolean {
  const source = rate?.usd_source?.trim() ?? "";
  if (!source) return false;
  return !/demo/i.test(source);
}

function bcvHint(rate: FxRate | null): string {
  const source = rate?.usd_source?.trim();
  if (source) return source;
  if (rate?.usd_to_ves) return "Tasa local · pulsa Actualizar ahora";
  return "Sin tasa BCV";
}

function spreadUsdtOverBcv(rate: FxRate | null): { ratio: string; pct: string } | null {
  const bcv = Number(rate?.usd_to_ves);
  const usdt = Number(rate?.usdt_to_ves);
  if (!(bcv > 0) || !(usdt > 0)) return null;
  const ratio = usdt / bcv;
  const pct = (ratio - 1) * 100;
  return {
    ratio: ratio.toLocaleString("es-VE", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }),
    pct: `${pct >= 0 ? "+" : ""}${pct.toLocaleString("es-VE", {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    })} %`,
  };
}

/** Tasas VE: USD BCV, USDT P2P y BS (alias BCV). Equivalencias de precio vienen después. */
export function FxRatePage() {
  const [today, setToday] = useState<FxRate | null>(null);
  const [history, setHistory] = useState<FxRate[]>([]);
  const [rateDate, setRateDate] = useState(todayISO);
  const [usdToVes, setUsdToVes] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [okNote, setOkNote] = useState<string | null>(null);
  const autoTried = useRef(false);

  const reload = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
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
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function onRefresh() {
    setRefreshing(true);
    setError(null);
    setOkNote(null);
    try {
      const saved = await refreshFxRates();
      setOkNote(
        `Captura ${saved.rate_date}: BCV ${formatBsRate(saved.usd_to_ves)} Bs/$` +
          (saved.usdt_to_ves ? ` · USDT ${formatBsRate(saved.usdt_to_ves)}` : ""),
      );
      await reload(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudieron consultar las fuentes");
    } finally {
      setRefreshing(false);
    }
  }

  useEffect(() => {
    if (loading || autoTried.current || refreshing) return;
    if (today && isLiveBcv(today)) return;
    autoTried.current = true;
    void onRefresh();
    // Primera visita: sustituye el 36,50 de seed por BCV/USDT reales.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, today]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const value = Number(usdToVes);
    if (!Number.isFinite(value) || value <= 0) {
      setError("Tasa BCV inválida");
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
      setOkNote(`BCV manual: 1 USD = ${formatBsRate(saved.usd_to_ves)} Bs (${saved.rate_date})`);
      setNotes("");
      await reload();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo guardar");
    } finally {
      setBusy(false);
    }
  }

  const captured = today?.captured_at ? formatDateTime(today.captured_at) : null;
  const spread = spreadUsdtOverBcv(today);

  return (
    <WorkspacePage
      eyebrow="Finanzas"
      title="Tasas"
      blurb="USD BCV, USDT P2P y el diferencial USDT/BCV. Las equivalencias de precio se integran después."
    >
      <header className="page-header page-header-with-action">
        <div>
          <p className="eyebrow">Supervisor · finanzas</p>
          <h1 className="display-title">Tasas BCV.</h1>
          <p className="muted">
            Oficial (Bs) y USDT P2P. La venta en Bs usa el USD BCV del día.
            {captured ? ` · Capturado ${captured}` : ""}
          </p>
        </div>
        <Button
          type="button"
          variant="accent"
          disabled={refreshing || loading}
          onClick={() => void onRefresh()}
        >
          <RefreshCw size={16} aria-hidden />
          {refreshing ? "Consultando…" : "Actualizar ahora"}
        </Button>
      </header>

      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}
      {okNote ? <p className="offline-banner is-online">{okNote}</p> : null}

      <MetricGrid aria-label="Tasas vigentes">
        <MetricTile
          label="USD BCV"
          value={loading ? "…" : formatBsRate(today?.usd_to_ves)}
          markSrc="/pay/bcv.png"
          tone="solid"
          hint={
            loading
              ? "Cargando…"
              : refreshing
                ? "Consultando DolarApi…"
                : bcvHint(today)
          }
        />
        <MetricTile
          label="USDT"
          value={loading ? "…" : formatBsRate(today?.usdt_to_ves)}
          markSrc="/pay/binance.png"
          tone="accent"
          hint={
            loading
              ? "Cargando…"
              : refreshing
                ? "Consultando Binance P2P…"
                : today?.usdt_source?.trim() || "Sin captura USDT"
          }
        />
        <MetricTile
          label="USDT / BCV"
          value={loading ? "…" : spread ? spread.ratio : "—"}
          tone="success"
          hint={
            loading
              ? "Cargando…"
              : spread
                ? `${spread.pct} sobre BCV`
                : "Falta USDT o BCV"
          }
        />
        <MetricTile
          label="EUR BCV"
          value={loading ? "…" : formatBsRate(today?.eur_to_ves)}
          markSrc="/pay/bcv.png"
          hint={
            loading
              ? "Cargando…"
              : refreshing
                ? "Consultando DolarApi…"
                : today?.eur_source?.trim() || "Sin captura EUR"
          }
        />
      </MetricGrid>

      <section className="card seller-panel" style={{ marginTop: "0.85rem" }}>
        <div className="seller-panel-head">
          <h2 className="section-heading">Ajuste manual BCV</h2>
        </div>
        <p className="muted small" style={{ marginTop: 0 }}>
          Si las fuentes fallan, puedes fijar el USD BCV del día. No sustituye la captura USDT.
        </p>
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
            label="Bs por 1 USD (BCV)"
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
            placeholder="Ajuste interno, feriado BCV…"
          />
          <Button type="submit" variant="secondary" block disabled={busy}>
            Guardar BCV
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
                    {r.rate_date} · BCV {formatBsRate(r.usd_to_ves)}
                    {r.usdt_to_ves ? ` · USDT ${formatBsRate(r.usdt_to_ves)}` : ""}
                    {r.eur_to_ves ? ` · EUR ${formatBsRate(r.eur_to_ves)}` : ""}
                  </p>
                  <p className="muted small">
                    {[r.usd_source, r.usdt_source].filter(Boolean).join(" · ") || r.notes || "Sin fuente"}
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
