import { RefreshCw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { AlertNoticeItem } from "../components/AlertNoticeItem";
import { Button } from "../components/Button";
import { WorkspacePage } from "../layout/WorkspacePage";
import { ApiError, acknowledgeAlert, fetchAlerts } from "../lib/api";
import type { VisitAlert } from "../lib/types";

/** Inbox: GPS/foto para supervisor; avisos de ruta para vendedor. */
export function AlertsInboxPage() {
  const { user } = useAuth();
  const sellerInbox = user?.role === "vendedor";
  const [alerts, setAlerts] = useState<VisitAlert[]>([]);
  const [onlyPending, setOnlyPending] = useState(true);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await fetchAlerts({ unacked_only: onlyPending });
      setAlerts(list);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudieron cargar alertas");
    } finally {
      setLoading(false);
    }
  }, [onlyPending]);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function onAck(alertId: number) {
    setBusyId(alertId);
    setError(null);
    try {
      const updated = await acknowledgeAlert(alertId);
      if (onlyPending) {
        setAlerts((prev) => prev.filter((a) => a.id !== alertId));
      } else {
        setAlerts((prev) => prev.map((a) => (a.id === alertId ? updated : a)));
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo marcar como vista");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <WorkspacePage
      eyebrow="Operación"
      title={sellerInbox ? "Avisos" : "Alertas"}
      blurb={
        sellerInbox
          ? "Cuando el supervisor te mete una parada a la semana."
          : "Revisa y marca como vistas las alertas GPS y foto del equipo."
      }
    >
      <header className="page-header">
        <div>
          <p className="eyebrow">{sellerInbox ? "Tu ruta" : "Supervisor"}</p>
          <h1>{sellerInbox ? "Avisos" : "Alertas"}</h1>
          <p className="muted">
            {sellerInbox
              ? "Paradas nuevas de la semana. Márcalas cuando las veas."
              : "Cierres con GPS omitido, lejos del PDV, solo foto o precisión baja."}
          </p>
        </div>
        <Button type="button" variant="secondary" onClick={() => void reload()} disabled={loading}>
          <RefreshCw size={16} />
          Actualizar
        </Button>
      </header>

      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}

      <div className="alert-filters" role="tablist" aria-label="Filtro de alertas">
        <button
          type="button"
          className={onlyPending ? "chip active" : "chip"}
          onClick={() => setOnlyPending(true)}
        >
          Pendientes
        </button>
        <button
          type="button"
          className={!onlyPending ? "chip active" : "chip"}
          onClick={() => setOnlyPending(false)}
        >
          Todas
        </button>
      </div>

      {loading ? <p className="muted">Cargando…</p> : null}

      {!loading && alerts.length === 0 ? (
        <p className="card muted" style={{ margin: 0 }}>
          {onlyPending
            ? "No hay alertas pendientes."
            : sellerInbox
              ? "Aún no hay avisos. Aparecen cuando te asignan una parada."
              : "Aún no hay alertas. Se crean al cerrar visitas con GPS omitido, foto o lejos del pin."}
        </p>
      ) : null}

      <ul className="app-alerts-list alert-inbox-list">
        {alerts.map((a) => (
          <AlertNoticeItem
            key={a.id}
            alert={a}
            forSeller={sellerInbox}
            ackBusy={busyId === a.id}
            onAck={!a.acknowledged_at ? () => void onAck(a.id) : undefined}
          />
        ))}
      </ul>
    </WorkspacePage>
  );
}
