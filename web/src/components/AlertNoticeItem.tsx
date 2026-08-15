import { AlertTriangle, Check, MapPin } from "lucide-react";
import { alertSubline, alertTitle, routeStopWhen } from "../lib/alertNotice";
import type { VisitAlert } from "../lib/types";

type Props = {
  alert: VisitAlert;
  forSeller: boolean;
  ackBusy?: boolean;
  onAck?: () => void;
};

/** Fila de aviso/alerta: fecha de parada destacada; no repite el PDV abajo. */
export function AlertNoticeItem({ alert, forSeller, ackBusy, onAck }: Props) {
  const route = alert.alert_type === "route_assigned";
  const stop = route ? routeStopWhen(alert) : null;

  return (
    <li
      className={`app-alerts-item is-${alert.alert_type} sev-${alert.severity}${
        alert.acknowledged_at ? " is-acked" : ""
      }`.trim()}
    >
      <span className="app-alerts-icon" aria-hidden>
        {route ? <MapPin size={14} /> : <AlertTriangle size={14} />}
      </span>
      <div className="app-alerts-copy">
        <strong>{alertTitle(alert)}</strong>
        {stop ? (
          <div className="alert-stop-when">
            <span className={`alert-date-chip${stop.undated ? " is-open" : ""}`}>{stop.dateLabel}</span>
            {stop.timeLabel ? <span className="alert-time-chip">{stop.timeLabel}</span> : null}
          </div>
        ) : null}
        <span>{alertSubline(alert, forSeller)}</span>
      </div>
      {onAck && !alert.acknowledged_at ? (
        <button
          type="button"
          className="app-alerts-ack"
          disabled={ackBusy}
          onClick={onAck}
          title="Marcar vista"
        >
          <Check size={14} />
        </button>
      ) : null}
    </li>
  );
}
