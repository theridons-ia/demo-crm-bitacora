import { Calendar, Crosshair, MapPin, Play, ShieldCheck, ShoppingCart, Square, StickyNote, Trash2, XCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { Button } from "./Button";
import { CloseVisitSheet } from "./CloseVisitSheet";
import { LiveLed } from "./LiveLed";
import { Modal } from "./Modal";
import { SaleDetailSheet } from "./SaleDetailSheet";
import { VisitMapSheet } from "./VisitMapSheet";
import { VisitSaleWizard } from "./VisitSaleWizard";
import { formatDateTime, formatPillParts, todayISO } from "../lib/caracasTime";
import { rewriteCloseNote, saleOrderCode } from "../lib/saleLabels";
import { hasVisitSaleDraft } from "../lib/saleWizardDraft";
import { isVisitOverdue } from "../lib/visitOrder";
import { ApiError, cancelVisit, pinVisitGps, startVisit } from "../lib/api";
import { coordsFromClient, distanceMeters, getCurrentPosition, isMockGpsEnabled } from "../lib/gps";
import {
  GPS_FAR_M,
  parseCoord,
  visitGpsProof,
} from "../lib/visitEvidence";
import type { Visit, VisitStatus } from "../lib/types";

type Props = {
  visit: Visit;
  open: boolean;
  onClose: () => void;
  onUpdated: (visit: Visit) => void;
  /** Supervisor: quitar una programada de la ruta del día. */
  onRemoveFromRoute?: () => void;
};

const STATUS_LABEL: Record<VisitStatus, string> = {
  programada: "Programada",
  en_curso: "En curso",
  completada: "Culminada",
  cancelada: "Cancelada",
};

function formatWhen(iso: string | null | undefined): string {
  if (!iso) return "—";
  return formatDateTime(iso);
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

function VisitRangePills({ visit }: { visit: Visit }) {
  const start = formatPillParts(visit.visited_at);
  if (!start && visit.status !== "en_curso" && visit.status !== "completada") {
    return null;
  }
  const endIso = visit.closed_at ?? visit.end_gps_captured_at ?? null;
  const end = formatPillParts(endIso);
  const endPending = visit.status === "en_curso";

  return (
    <div className="visit-range" role="group" aria-label="Inicio y fin de la visita">
      <article className="visit-range-pill">
        <Calendar size={18} aria-hidden />
        <div className="visit-range-copy">
          <span className="muted small">Inicio</span>
          {start ? (
            <>
              <strong>{start.date}</strong>
              <span className="visit-range-time">{start.time}</span>
            </>
          ) : (
            <strong>Pendiente</strong>
          )}
        </div>
      </article>
      <article className={`visit-range-pill ${endPending ? "is-live" : ""}`.trim()}>
        <Calendar size={18} aria-hidden />
        <div className="visit-range-copy">
          <span className="muted small">Fin</span>
          {endPending ? (
            <strong>En curso</strong>
          ) : end ? (
            <>
              <strong>{end.date}</strong>
              <span className="visit-range-time">{end.time}</span>
            </>
          ) : (
            <strong>—</strong>
          )}
        </div>
      </article>
    </div>
  );
}

function formatCoordPair(lat: number, lng: number): string {
  return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
}

function gpsConfirmMessage(visit: Visit, failReason: string | null): string | null {
  if (failReason) {
    return `${failReason}. Mala señal o sin conexión. Puedes continuar sin GPS (temporal) y actualizar después.`;
  }
  const pdv = coordsFromClient(visit.client);
  const lat = parseCoord(visit.latitude);
  const lng = parseCoord(visit.longitude);
  if (lat == null || lng == null || !pdv) return null;
  const dist = distanceMeters(lat, lng, pdv.latitude, pdv.longitude);
  if (dist <= GPS_FAR_M) return null;
  return `La marca está a ~${Math.round(dist)} m del PDV. Si no es el local, actualiza el GPS.`;
}

function VisitGpsEvidence({
  visit,
  hasGps,
  canPinGps,
  gpsBusy,
  gpsOk,
  onPinGps,
  onShowMap,
}: {
  visit: Visit;
  hasGps: boolean;
  canPinGps: boolean;
  gpsBusy: boolean;
  gpsOk: string | null;
  onPinGps: () => void;
  onShowMap: () => void;
}) {
  const startLat = parseCoord(visit.latitude);
  const startLng = parseCoord(visit.longitude);
  const endLat = parseCoord(visit.end_latitude);
  const endLng = parseCoord(visit.end_longitude);
  const hasEnd = endLat != null && endLng != null;
  const pdv = coordsFromClient(visit.client);
  const startEndM =
    startLat != null && startLng != null && hasEnd
      ? distanceMeters(startLat, startLng, endLat, endLng)
      : null;
  const startPdvM =
    startLat != null && startLng != null && pdv
      ? distanceMeters(startLat, startLng, pdv.latitude, pdv.longitude)
      : null;
  const endPdvM =
    hasEnd && pdv ? distanceMeters(endLat, endLng, pdv.latitude, pdv.longitude) : null;
  const farStartEnd = startEndM != null && startEndM > GPS_FAR_M;
  const farStartPdv = startPdvM != null && startPdvM > GPS_FAR_M;
  const farEndPdv = endPdvM != null && endPdvM > GPS_FAR_M;
  const proof = visitGpsProof(visit);

  return (
    <section className={`visit-gps-card ${hasGps || hasEnd ? "has-fix" : "needs-fix"}`.trim()}>
      <div className="visit-gps-copy">
        <p className="eyebrow">Ubicación GPS</p>
        {hasGps || hasEnd ? (
          <div className="visit-gps-pair">
            <div>
              <span className="muted small">Inicio</span>
              {startLat != null && startLng != null ? (
                <>
                  <strong>{formatCoordPair(startLat, startLng)}</strong>
                  <span className="muted small">
                    {visit.gps_accuracy_m
                      ? `±${Number(visit.gps_accuracy_m).toFixed(0)} m`
                      : "Precisión no reportada"}
                    {visit.gps_offline ? " · prueba / offline" : ""}
                    {visit.gps_captured_at ? ` · ${formatWhen(visit.gps_captured_at)}` : ""}
                  </span>
                </>
              ) : (
                <strong>Sin punto de inicio</strong>
              )}
            </div>
            {visit.status === "completada" || hasEnd ? (
              <div>
                <span className="muted small">Cierre</span>
                {hasEnd ? (
                  <>
                    <strong>{formatCoordPair(endLat, endLng)}</strong>
                    <span className="muted small">
                      {visit.end_gps_accuracy_m
                        ? `±${Number(visit.end_gps_accuracy_m).toFixed(0)} m`
                        : "Precisión no reportada"}
                      {visit.end_gps_captured_at
                        ? ` · ${formatWhen(visit.end_gps_captured_at)}`
                        : ""}
                    </span>
                  </>
                ) : (
                  <strong>Sin punto de cierre</strong>
                )}
              </div>
            ) : null}
          </div>
        ) : (
          <>
            <strong>Sin coordenada aún</strong>
            <span className="muted small">
              {isMockGpsEnabled()
                ? "GPS de prueba activo en el header. Pulsa guardar para fijar el punto."
                : "Al iniciar se toma fecha, hora y GPS. También puedes capturar ahora."}
            </span>
          </>
        )}
        {startEndM != null ? (
          <p className={`visit-gps-span ${farStartEnd ? "is-warn" : ""}`.trim()}>
            Inicio y cierre a ~{Math.round(startEndM)} m
            {farStartEnd ? " (deberían estar en el mismo PDV)" : ""}
          </p>
        ) : null}
        {farStartPdv && visit.status === "en_curso" ? (
          <p className={`visit-gps-span is-warn`}>
            Inicio a ~{Math.round(startPdvM!)} m del PDV. Actualiza el GPS si no estás en el local.
          </p>
        ) : startPdvM != null ? (
          <p className={`visit-gps-span ${farStartPdv ? "is-warn" : ""}`.trim()}>
            Inicio a ~{Math.round(startPdvM)} m del PDV
          </p>
        ) : null}
        {endPdvM != null ? (
          <p className={`visit-gps-span ${farEndPdv ? "is-warn" : ""}`.trim()}>
            Cierre a ~{Math.round(endPdvM)} m del PDV
          </p>
        ) : null}
        {gpsOk ? <p className="gps-ok-note">{gpsOk}</p> : null}
        {proof !== "none" ? (
          <p className="visit-gps-proof">
            <ShieldCheck size={14} aria-hidden />
            {proof === "full"
              ? "Prueba de visita: GPS de inicio y cierre"
              : proof === "photo"
                ? "Prueba de visita: foto del PDV"
                : "Prueba de visita: GPS parcial"}
          </p>
        ) : null}
      </div>
      <div className="visit-gps-actions">
        {canPinGps ? (
          <Button
            type="button"
            variant={hasGps ? "secondary" : "accent"}
            disabled={gpsBusy}
            onClick={onPinGps}
          >
            <Crosshair size={16} />
            {gpsBusy ? "Obteniendo…" : hasGps ? "Actualizar GPS" : "Guardar GPS ahora"}
          </Button>
        ) : null}
        {visit.id > 0 ? (
          <Button type="button" variant="secondary" onClick={onShowMap}>
            <MapPin size={16} />
            Ver mapa
          </Button>
        ) : null}
      </div>
    </section>
  );
}

/** Ficha de visita: identidad, GPS accionable, OV y cierre. */
export function VisitDetailSheet({ visit, open, onClose, onUpdated, onRemoveFromRoute }: Props) {
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
  const [gpsConfirm, setGpsConfirm] = useState(false);
  const [gpsConfirmNote, setGpsConfirmNote] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setCurrent(visit);
  }, [open, visit]);

  useEffect(() => {
    if (!open) {
      setGpsConfirm(false);
      return;
    }
    setError(null);
    setGpsOk(null);
    setClosing(false);
    setSelling((prev) => prev || hasVisitSaleDraft(visit.id));
    setShowMap(false);
    setGpsConfirm(false);
    setGpsConfirmNote(null);
    setViewSaleDoc(false);
    setConfirmCancel(false);
    setSaleJustConfirmed(false);
  }, [open, visit.id]);

  const clientName = current.client?.name ?? `Cliente #${current.client_id}`;
  const clientId =
    current.client?.rif ?? (current.client?.ci ? `CI ${current.client.ci}` : null);
  const timeLabel =
    current.scheduled_time != null ? String(current.scheduled_time).slice(0, 5) : null;
  const live = current.status === "en_curso";
  const overdue = isVisitOverdue(current, todayISO());
  const statusTitle = overdue ? "Sin asistir" : live ? "En curso" : STATUS_LABEL[current.status];
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
    setGpsConfirmNote(null);
    try {
      const geo = await getCurrentPosition(15_000, coordsFromClient(current.client), {
        maximumAge: 0,
      });
      const updated = await startVisit(current.id, {
        latitude: geo.ok ? geo.fix.latitude : null,
        longitude: geo.ok ? geo.fix.longitude : null,
        gps_accuracy_m: geo.ok ? (geo.fix.accuracy_m ?? null) : null,
        gps_offline: !geo.ok,
      });
      setCurrent(updated);
      onUpdated(updated);
      setGpsConfirmNote(gpsConfirmMessage(updated, geo.ok ? null : geo.reason));
      setGpsConfirm(true);
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
      const geo = await getCurrentPosition(15_000, coordsFromClient(current.client), {
        maximumAge: 0,
      });
      if (!geo.ok) {
        const fail =
          `${geo.reason}. Mala señal o sin conexión. Puedes continuar y reintentar; el cierre también toma GPS.`;
        setError(fail);
        setGpsConfirmNote(fail);
        return;
      }
      const updated = await pinVisitGps(current.id, {
        latitude: geo.fix.latitude,
        longitude: geo.fix.longitude,
        gps_accuracy_m: geo.fix.accuracy_m,
        gps_offline: Boolean(geo.fix.mocked),
        replace_start: true,
      });
      setCurrent(updated);
      onUpdated(updated);
      const acc =
        geo.fix.accuracy_m != null ? ` · ±${Math.round(geo.fix.accuracy_m)} m` : "";
      setGpsOk(
        `${geo.fix.mocked ? "GPS de prueba" : "Posición de inicio"} actualizada${acc}`,
      );
      setGpsConfirmNote(gpsConfirmMessage(updated, null));
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

  const overlayOpen = closing || selling || showMap || viewSaleDoc || gpsConfirm;
  const note = rewriteCloseNote(current.description, sale);

  return (
    <>
      <Modal
        open={open && !overlayOpen}
        onClose={onClose}
        eyebrow="Visita"
        title={statusTitle}
        footer={
          <div className="side-sheet-actions visit-ficha-actions">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cerrar ficha
            </Button>
            {onRemoveFromRoute && current.status === "programada" ? (
              <Button type="button" variant="ghost" onClick={onRemoveFromRoute}>
                <Trash2 size={16} />
                Quitar de la ruta
              </Button>
            ) : null}
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
                {current.seller?.full_name ? ` · ${current.seller.full_name}` : ""}
              </span>
            </div>
            {live ? <LiveLed size="sm" /> : overdue ? (
              <span className="badge badge-programada">Sin asistir</span>
            ) : (
              <span className={`badge badge-${current.status}`}>{STATUS_LABEL[current.status]}</span>
            )}
          </div>

          <div className={`visit-detail-hero ${heroClass}`.trim()}>
            <div className="visit-detail-hero-copy">
              <p className="eyebrow">Estado</p>
              {live ? <LiveLed size="md" /> : <strong>{statusTitle}</strong>}
              {overdue ? (
                <p className="muted small" style={{ margin: "0.35rem 0 0" }}>
                  La fecha ya pasó. Inicia ahora o cancélala.
                </p>
              ) : current.result ? (
                <p className="muted small" style={{ margin: "0.35rem 0 0" }}>
                  {current.result === "sin_venta" ? "Culminada sin venta" : "Culminada con venta"}
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
                <strong>{saleOrderCode(sale)}</strong>
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

          <VisitRangePills visit={current} />

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
          </div>

          {note ? (
            <section className="visit-note-card" aria-label="Nota de la visita">
              <p className="eyebrow">
                <StickyNote size={12} aria-hidden /> Nota de campo
              </p>
              <p>{note}</p>
            </section>
          ) : null}

          <VisitGpsEvidence
            visit={current}
            hasGps={hasGps}
            canPinGps={canPinGps}
            gpsBusy={gpsBusy}
            gpsOk={gpsOk}
            onPinGps={() => void onPinGps()}
            onShowMap={() => setShowMap(true)}
          />

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

      {showMap || gpsConfirm ? (
        <VisitMapSheet
          visit={current}
          open
          eyebrow={gpsConfirm ? "Confirmar posición" : undefined}
          blurb={
            gpsConfirm
              ? hasGps
                ? `¿Estás en ${clientName}?`
                : "No hay GPS aún. Reintenta o continúa sin conexión (temporal)."
              : undefined
          }
          notice={
            gpsConfirm && gpsConfirmNote ? (
              <p className="visit-gps-span is-warn" role="status">
                {gpsConfirmNote}
              </p>
            ) : null
          }
          footer={
            gpsConfirm ? (
              <div className="side-sheet-actions">
                <Button
                  type="button"
                  variant={hasGps ? "accent" : "ghost"}
                  disabled={gpsBusy}
                  onClick={() => setGpsConfirm(false)}
                >
                  {hasGps ? "Sí, estoy aquí" : "Continuar sin GPS"}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  disabled={gpsBusy}
                  onClick={() => void onPinGps()}
                >
                  <Crosshair size={16} />
                  {gpsBusy ? "Actualizando…" : "Actualizar GPS"}
                </Button>
              </div>
            ) : undefined
          }
          onClose={() => {
            setShowMap(false);
            setGpsConfirm(false);
          }}
        />
      ) : null}
    </>
  );
}
