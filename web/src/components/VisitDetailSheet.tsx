import { Calendar, Clock, Crosshair, MapPin, Play, ShoppingCart, Square, XCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { Button } from "./Button";
import { CloseVisitSheet } from "./CloseVisitSheet";
import { LiveLed } from "./LiveLed";
import { Modal } from "./Modal";
import { SaleDetailSheet } from "./SaleDetailSheet";
import { VisitMapSheet } from "./VisitMapSheet";
import { VisitSaleWizard } from "./VisitSaleWizard";
import { ApiError, cancelVisit, pinVisitGps, startVisit } from "../lib/api";
import { coordsFromClient, getCurrentPosition, isMockGpsEnabled } from "../lib/gps";
import type { Visit, VisitStatus } from "../lib/types";

type Props = {
  visit: Visit;
  open: boolean;
  onClose: () => void;
  onUpdated: (visit: Visit) => void;
};

const STATUS_LABEL: Record<VisitStatus, string> = {
  programada: "Programada",
  en_curso: "En curso",
  completada: "Cerrada",
  cancelada: "Cancelada",
};

function formatWhen(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("es-VE", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

/** Ficha de visita: identidad, GPS accionable, OV y cierre. */
export function VisitDetailSheet({ visit, open, onClose, onUpdated }: Props) {
  const { user } = useAuth();
  const [busy, setBusy] = useState(false);
  const [gpsBusy, setGpsBusy] = useState(false);
  const [gpsOk, setGpsOk] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [closing, setClosing] = useState(false);
  const [selling, setSelling] = useState(false);
  const [showMap, setShowMap] = useState(false);
  const [viewSaleDoc, setViewSaleDoc] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [current, setCurrent] = useState(visit);
  const [saleJustConfirmed, setSaleJustConfirmed] = useState(false);

  useEffect(() => {
    if (!open) return;
    setCurrent(visit);
    setError(null);
    setGpsOk(null);
    setClosing(false);
    setSelling(false);
    setShowMap(false);
    setViewSaleDoc(false);
    setConfirmCancel(false);
    setSaleJustConfirmed(false);
  }, [open, visit]);

  const clientName = current.client?.name ?? `Cliente #${current.client_id}`;
  const clientId =
    current.client?.rif ?? (current.client?.ci ? `CI ${current.client.ci}` : null);
  const timeLabel =
    current.scheduled_time != null ? String(current.scheduled_time).slice(0, 5) : null;
  const live = current.status === "en_curso";
  const sale = current.sale ?? null;
  const itemCount = sale?.items?.length ?? 0;
  const hasGps = current.latitude != null && current.longitude != null;
  const canPinGps =
    current.id > 0 &&
    (current.status === "programada" || current.status === "en_curso");
  const heroClass =
    current.status === "en_curso"
      ? ""
      : current.status === "completada"
        ? "is-done"
        : current.status === "cancelada"
          ? "is-cancelled"
          : "is-planned";

  async function onStart() {
    setBusy(true);
    setError(null);
    try {
      const geo = await getCurrentPosition(15_000, coordsFromClient(current.client));
      const updated = await startVisit(current.id, {
        latitude: geo.ok ? geo.fix.latitude : null,
        longitude: geo.ok ? geo.fix.longitude : null,
        gps_accuracy_m: geo.ok ? (geo.fix.accuracy_m ?? null) : null,
        gps_offline: !geo.ok,
      });
      setCurrent(updated);
      onUpdated(updated);
      if (!geo.ok) setError(`Iniciada sin GPS: ${geo.reason}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo iniciar la visita");
    } finally {
      setBusy(false);
    }
  }

  async function onPinGps() {
    setGpsBusy(true);
    setError(null);
    setGpsOk(null);
    try {
      const geo = await getCurrentPosition(15_000, coordsFromClient(current.client));
      if (!geo.ok) {
        setError(geo.reason);
        return;
      }
      const updated = await pinVisitGps(current.id, {
        latitude: geo.fix.latitude,
        longitude: geo.fix.longitude,
        gps_accuracy_m: geo.fix.accuracy_m,
        gps_offline: Boolean(geo.fix.mocked),
      });
      setCurrent(updated);
      onUpdated(updated);
      const acc =
        geo.fix.accuracy_m != null ? ` · ±${Math.round(geo.fix.accuracy_m)} m` : "";
      setGpsOk(
        `${geo.fix.mocked ? "GPS de prueba" : "GPS"} guardado${acc}`,
      );
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo guardar el GPS");
    } finally {
      setGpsBusy(false);
    }
  }

  async function onCancel() {
    if (!confirmCancel) {
      setConfirmCancel(true);
      setError(null);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const updated = await cancelVisit(current.id, { description: "Cancelada" });
      setCurrent(updated);
      setConfirmCancel(false);
      onUpdated(updated);
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo cancelar la visita");
    } finally {
      setBusy(false);
    }
  }

  const canCancel =
    !sale && (current.status === "programada" || current.status === "en_curso");

  const overlayOpen = closing || selling || showMap || viewSaleDoc;

  return (
    <>
      <Modal
        open={open && !overlayOpen}
        onClose={onClose}
        eyebrow="Visita"
        title={clientName}
        footer={
          <div className="side-sheet-actions visit-ficha-actions">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cerrar ficha
            </Button>
            {canCancel ? (
              <Button
                type="button"
                variant="ghost"
                disabled={busy}
                onClick={() => void onCancel()}
              >
                <XCircle size={16} />
                {confirmCancel ? "Confirmar" : "Cancelar visita"}
              </Button>
            ) : null}
            {current.status === "programada" ? (
              <Button type="button" variant="accent" disabled={busy} onClick={() => void onStart()}>
                <Play size={16} />
                {busy ? "Iniciando…" : "Iniciar"}
              </Button>
            ) : null}
            {current.status === "en_curso" && !sale ? (
              <Button type="button" variant="accent" onClick={() => setSelling(true)}>
                <ShoppingCart size={16} />
                Registrar venta
              </Button>
            ) : null}
            {current.status === "en_curso" ? (
              <Button
                type="button"
                variant={sale ? "accent" : "secondary"}
                onClick={() => setClosing(true)}
              >
                <Square size={16} />
                Cerrar visita
              </Button>
            ) : null}
          </div>
        }
      >
        <div className="visit-detail">
          <div className="visit-ficha-id">
            <span className="visit-ficha-avatar" aria-hidden>
              {initials(clientName)}
            </span>
            <div className="visit-ficha-id-copy">
              <p className="eyebrow">Punto de venta</p>
              <strong>{clientName}</strong>
              <span className="muted small">
                {clientId ?? "Sin RIF/CI"}
                {current.client?.state ? ` · ${current.client.state}` : ""}
              </span>
            </div>
            {live ? <LiveLed size="sm" /> : (
              <span className={`badge badge-${current.status}`}>{STATUS_LABEL[current.status]}</span>
            )}
          </div>

          <div className={`visit-detail-hero ${heroClass}`.trim()}>
            <div className="visit-detail-hero-copy">
              <p className="eyebrow">Estado</p>
              {live ? <LiveLed size="md" /> : <strong>{STATUS_LABEL[current.status]}</strong>}
              {current.result ? (
                <p className="muted small" style={{ margin: "0.35rem 0 0" }}>
                  {current.result === "sin_venta" ? "Cerrada sin venta" : "Cerrada con venta"}
                </p>
              ) : live && !sale ? (
                <p className="muted small" style={{ margin: "0.35rem 0 0" }}>
                  Registra la OV y luego cierra con evidencia.
                </p>
              ) : null}
              {confirmCancel ? (
                <p className="muted small" style={{ margin: "0.35rem 0 0" }}>
                  Se marcará como cancelada. Pulsa de nuevo para confirmar.
                </p>
              ) : null}
            </div>
          </div>

          {sale ? (
            <div
              className={`visit-sale-confirmed ${saleJustConfirmed ? "is-flash" : ""}`.trim()}
              role="status"
            >
              <div className="visit-sale-confirmed-copy">
                <p className="eyebrow">Orden de venta</p>
                <strong>OV-{sale.id}</strong>
                <div className="visit-sale-metrics">
                  <div>
                    <span className="muted small">Total</span>
                    <b>
                      ${Number(sale.total_amount).toFixed(2)} {sale.currency}
                    </b>
                  </div>
                  <div>
                    <span className="muted small">Ítems</span>
                    <b>{itemCount}</b>
                  </div>
                  <div>
                    <span className="muted small">Pago</span>
                    <b>{sale.is_credit ? "Crédito" : "Contado"}</b>
                  </div>
                </div>
                {saleJustConfirmed ? (
                  <p className="gps-ok-note" style={{ marginTop: "0.55rem" }}>
                    Venta registrada. Ya puedes cerrar la visita.
                  </p>
                ) : null}
                <div style={{ marginTop: "0.65rem" }}>
                  <Button type="button" variant="secondary" onClick={() => setViewSaleDoc(true)}>
                    Ver cotización / OV
                  </Button>
                </div>
              </div>
            </div>
          ) : null}

          <div className="visit-ficha-facts">
            {current.client?.address ? (
              <article className="visit-ficha-fact">
                <span className="muted small">Dirección</span>
                <strong>{current.client.address}</strong>
              </article>
            ) : null}
            {current.scheduled_date ? (
              <article className="visit-ficha-fact">
                <span className="muted small">
                  <Calendar size={12} /> Agenda
                </span>
                <strong>
                  {current.scheduled_date}
                  {timeLabel ? ` · ${timeLabel}` : ""}
                </strong>
              </article>
            ) : null}
            {current.visited_at ? (
              <article className="visit-ficha-fact">
                <span className="muted small">
                  <Clock size={12} /> Inicio
                </span>
                <strong>{formatWhen(current.visited_at)}</strong>
              </article>
            ) : null}
            {current.description ? (
              <article className="visit-ficha-fact">
                <span className="muted small">Nota</span>
                <strong>{current.description}</strong>
              </article>
            ) : null}
          </div>

          <section className={`visit-gps-card ${hasGps ? "has-fix" : "needs-fix"}`.trim()}>
            <div className="visit-gps-copy">
              <p className="eyebrow">Ubicación GPS</p>
              {hasGps ? (
                <>
                  <strong>
                    {Number(current.latitude).toFixed(5)}, {Number(current.longitude).toFixed(5)}
                  </strong>
                  <span className="muted small">
                    {current.gps_accuracy_m
                      ? `±${Number(current.gps_accuracy_m).toFixed(0)} m`
                      : "Precisión no reportada"}
                    {current.gps_offline ? " · prueba / offline" : ""}
                    {current.gps_captured_at ? ` · ${formatWhen(current.gps_captured_at)}` : ""}
                  </span>
                </>
              ) : (
                <>
                  <strong>Sin coordenada aún</strong>
                  <span className="muted small">
                    {isMockGpsEnabled()
                      ? "GPS de prueba activo en el header. Pulsa guardar para fijar el punto."
                      : "Captura ahora para dejar evidencia en la visita."}
                  </span>
                </>
              )}
              {gpsOk ? <p className="gps-ok-note">{gpsOk}</p> : null}
            </div>
            <div className="visit-gps-actions">
              {canPinGps ? (
                <Button
                  type="button"
                  variant={hasGps ? "secondary" : "accent"}
                  disabled={gpsBusy}
                  onClick={() => void onPinGps()}
                >
                  <Crosshair size={16} />
                  {gpsBusy ? "Obteniendo…" : hasGps ? "Actualizar GPS" : "Guardar GPS ahora"}
                </Button>
              ) : null}
              {current.id > 0 ? (
                <Button type="button" variant="secondary" onClick={() => setShowMap(true)}>
                  <MapPin size={16} />
                  Ver mapa
                </Button>
              ) : null}
            </div>
          </section>

          {error ? (
            <p className="form-error" role="alert">
              {error}
            </p>
          ) : null}
        </div>
      </Modal>

      {selling ? (
        <VisitSaleWizard
          visit={current}
          open
          onClose={() => setSelling(false)}
          onSold={(saleOut) => {
            const updated: Visit = { ...current, sale: saleOut };
            setCurrent(updated);
            setSaleJustConfirmed(true);
            setSelling(false);
            onUpdated(updated);
          }}
        />
      ) : null}

      {closing ? (
        <CloseVisitSheet
          visit={current}
          open
          onClose={() => setClosing(false)}
          onGoRegisterSale={() => {
            setClosing(false);
            setSelling(true);
          }}
          onClosed={(updated) => {
            setCurrent(updated);
            setClosing(false);
            onUpdated(updated);
            onClose();
          }}
          onVisitPatched={(updated) => {
            setCurrent(updated);
            onUpdated(updated);
          }}
        />
      ) : null}

      {viewSaleDoc && sale ? (
        <SaleDetailSheet
          sale={sale}
          open
          initialTab="documento"
          sellerName={user?.full_name ?? current.seller?.full_name ?? null}
          onClose={() => setViewSaleDoc(false)}
        />
      ) : null}

      {showMap ? (
        <VisitMapSheet visit={current} open onClose={() => setShowMap(false)} />
      ) : null}
    </>
  );
}
