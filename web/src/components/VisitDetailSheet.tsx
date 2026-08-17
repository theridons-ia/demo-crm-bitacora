import { Calendar, ChevronDown, Crosshair, MapPin, Play, ShieldCheck, ShoppingCart, Square, StickyNote, Trash2, XCircle } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { Button } from "./Button";
import { ClientDetailSheet } from "./ClientDetailSheet";
import { CloseVisitSheet } from "./CloseVisitSheet";
import { GpsProofPin } from "./GpsProofLegend";
import { LiveLed } from "./LiveLed";
import { Modal } from "./Modal";
import { SaleDetailSheet } from "./SaleDetailSheet";
import { TextAreaField } from "./TextField";
import { VisitMapSheet } from "./VisitMapSheet";
import { VisitSaleWizard } from "./VisitSaleWizard";
import { formatDateTime, formatDurationHm, formatPillParts, todayISO } from "../lib/caracasTime";
import { rewriteCloseNote, saleOrderCode, formatSaleTotal } from "../lib/saleLabels";
import {
  clearVisitSaleDraft,
  hasVisitSaleDraft,
} from "../lib/saleWizardDraft";
import {
  clearVisitWork,
  loadVisitWork,
  saveVisitWork,
} from "../lib/visitWorkSession";
import {
  resolveVisitLog,
  visitLogLines,
  writeVisitLog,
} from "../lib/visitFieldLog";
import { isVisitOverdue } from "../lib/visitOrder";
import { ApiError, cancelVisit, patchVisitNotes, pinVisitGps, startVisit } from "../lib/api";
import { coordsFromClient, distanceMeters, getCurrentPosition, isMockGpsEnabled } from "../lib/gps";
import {
  GPS_FAR_M,
  GPS_PROOF_OK_M,
  GPS_PROOF_PARTIAL_M,
  parseCoord,
  visitGpsProof,
  visitGpsProofDetail,
  visitGpsProofLabel,
} from "../lib/visitEvidence";
import type { Visit, VisitStatus } from "../lib/types";

type Props = {
  visit: Visit;
  open: boolean;
  onClose: () => void;
  onUpdated: (visit: Visit) => void;
  /** Supervisor: quitar una programada de la ruta del día. */
  onRemoveFromRoute?: () => void;
  /** Tras crear con Ahora: misma pregunta «¿Estás aquí?» que al Iniciar. */
  confirmHereOnOpen?: boolean;
  confirmHereFailReason?: string | null;
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

function distTone(meters: number | null, completed: boolean): string {
  if (meters == null) return "";
  if (!completed) return meters > GPS_FAR_M ? "is-warn" : "";
  if (meters <= GPS_PROOF_OK_M) return "is-ok";
  if (meters <= GPS_PROOF_PARTIAL_M) return "is-partial";
  return "is-bad";
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
  const completed = visit.status === "completada";
  const proof = visitGpsProof(visit);
  const proofDetail = visitGpsProofDetail(proof);
  const proofLabel = visitGpsProofLabel(proof);

  const body = (
    <>
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
                : "Si el GPS de inicio falló, puedes actualizarlo aquí."}
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
          <p className={`visit-gps-span ${distTone(startPdvM, completed)}`.trim()}>
            Inicio a ~{Math.round(startPdvM)} m del PDV
          </p>
        ) : null}
        {endPdvM != null ? (
          <p className={`visit-gps-span ${distTone(endPdvM, completed)}`.trim()}>
            Cierre a ~{Math.round(endPdvM)} m del PDV
          </p>
        ) : null}
        {gpsOk ? <p className="gps-ok-note">{gpsOk}</p> : null}
        {proofDetail ? (
          <p className={`visit-gps-proof is-${proof}`}>
            <ShieldCheck size={14} aria-hidden />
            {proofDetail}
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
    </>
  );

  const cardClass = `visit-gps-card ${hasGps || hasEnd ? "has-fix" : "needs-fix"}`.trim();

  return (
    <details className={`${cardClass} visit-gps-fold`}>
      <summary className="visit-gps-summary">
        <MapPin size={16} aria-hidden />
        <span>GPS</span>
        {proofLabel ? (
          <span className={`visit-gps-proof-flag is-${proof}`}>
            <GpsProofPin kind={proof} size={13} />
            {proofLabel}
          </span>
        ) : (
          <span className="muted small">
            {hasGps || hasEnd ? "Registrado · tocar para ver" : "Oculto · tocar para ver"}
          </span>
        )}
        <ChevronDown size={16} aria-hidden className="visit-gps-chevron" />
      </summary>
      {body}
    </details>
  );
}

/** Ficha de visita: identidad, GPS accionable, OV y cierre. */
export function VisitDetailSheet({
  visit,
  open,
  onClose,
  onUpdated,
  onRemoveFromRoute,
  confirmHereOnOpen = false,
  confirmHereFailReason = null,
}: Props) {
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
  const [gpsConfirm, setGpsConfirm] = useState(
    () => Boolean(confirmHereOnOpen && visit.status === "en_curso"),
  );
  const [gpsConfirmNote, setGpsConfirmNote] = useState<string | null>(null);
  const [showClient, setShowClient] = useState(false);
  const [fieldLog, setFieldLog] = useState(() =>
    resolveVisitLog(visit.id, visit.field_notes, visit.local_uuid),
  );
  const fieldLogRef = useRef(fieldLog);
  const currentRef = useRef(visit);
  const logTimer = useRef<number | null>(null);
  const hereAcked = useRef(false);

  useEffect(() => {
    currentRef.current = current;
  }, [current]);

  useEffect(() => {
    fieldLogRef.current = fieldLog;
  }, [fieldLog]);

  useEffect(() => {
    if (!open) return;
    setCurrent((prev) => {
      if (prev.id !== visit.id) return visit;
      return {
        ...visit,
        field_notes: visit.field_notes ?? prev.field_notes,
        sale: visit.sale ?? prev.sale,
      };
    });
  }, [open, visit]);

  useLayoutEffect(() => {
    if (!open) {
      hereAcked.current = false;
      setGpsConfirm(false);
      setShowClient(false);
      return;
    }
    const initial = resolveVisitLog(visit.id, visit.field_notes, visit.local_uuid);
    setFieldLog(initial);
    fieldLogRef.current = initial;
    setError(null);
    setGpsOk(null);
    setClosing(false);
    setSelling((prev) => {
      const work = loadVisitWork();
      const resumeWizard = work?.visitId === visit.id && work.selling;
      return prev || resumeWizard || hasVisitSaleDraft(visit.id);
    });
    setShowMap(false);
    const shouldConfirm =
      confirmHereOnOpen && visit.status === "en_curso" && !hereAcked.current;
    setGpsConfirm(shouldConfirm);
    setGpsConfirmNote(
      shouldConfirm ? gpsConfirmMessage(visit, confirmHereFailReason ?? null) : null,
    );
    setViewSaleDoc(false);
    setConfirmCancel(false);
    setSaleJustConfirmed(false);
    setShowClient(false);
    if (visit.status === "en_curso") {
      saveVisitWork({
        visitId: visit.id,
        selling: hasVisitSaleDraft(visit.id),
        clientName: visit.client?.name ?? "",
      });
    }
  }, [open, visit.id, confirmHereOnOpen, confirmHereFailReason]);

  useEffect(() => {
    if (!open) return;

    function flushToPhone() {
      const row = currentRef.current;
      writeVisitLog(row.id, fieldLogRef.current, row.local_uuid);
    }

    function onHide() {
      if (document.visibilityState === "hidden") flushToPhone();
    }

    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", flushToPhone);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", flushToPhone);
      if (logTimer.current) window.clearTimeout(logTimer.current);
      const row = currentRef.current;
      const text = fieldLogRef.current;
      writeVisitLog(row.id, text, row.local_uuid);
      if (row.id > 0 && (row.status === "en_curso" || row.status === "programada")) {
        void patchVisitNotes(row.id, text).catch(() => undefined);
      }
    };
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
  const canPinGps = current.id > 0 && current.status === "en_curso";
  const heroClass =
    current.status === "en_curso"
      ? ""
      : current.status === "completada"
        ? "is-done"
        : current.status === "cancelada"
          ? "is-cancelled"
          : "is-planned";
  const stayLabel =
    current.status === "completada"
      ? formatDurationHm(
          current.visited_at || current.created_at,
          current.closed_at || current.end_gps_captured_at,
        )
      : null;

  function onAskHere() {
    setError(null);
    setGpsConfirmNote(null);
    setGpsConfirm(true);
  }

  function dismissHerePrompt() {
    hereAcked.current = true;
    setGpsConfirm(false);
  }

  async function onStart(opts?: { skipGps?: boolean }) {
    setBusy(true);
    setError(null);
    setGpsConfirmNote(null);
    try {
      const geo = opts?.skipGps
        ? ({ ok: false, skipped: true, reason: "Sin GPS" } as const)
        : await getCurrentPosition(15_000, coordsFromClient(current.client), {
            maximumAge: 0,
          });
      const updated = await startVisit(current.id, {
        latitude: geo.ok ? geo.fix.latitude : null,
        longitude: geo.ok ? geo.fix.longitude : null,
        gps_accuracy_m: geo.ok ? (geo.fix.accuracy_m ?? null) : null,
        gps_offline: !geo.ok,
      });
      const next = { ...updated, field_notes: fieldLogRef.current || updated.field_notes };
      setCurrent(next);
      onUpdated(next);
      saveVisitWork({
        visitId: updated.id,
        selling: false,
        clientName: updated.client?.name ?? visit.client?.name ?? "",
      });
      hereAcked.current = true;
      setGpsConfirm(false);
      if (!geo.ok) {
        setGpsOk(
          opts?.skipGps
            ? "Visita iniciada sin GPS. Puedes actualizarlo en la ficha."
            : `${geo.reason}. Visita iniciada sin GPS (temporal).`,
        );
      } else {
        const warn = gpsConfirmMessage(updated, null);
        if (warn) setGpsOk(warn);
      }
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

  async function pushFieldLog(text: string) {
    const row = currentRef.current;
    writeVisitLog(row.id, text, row.local_uuid);
    if (row.id <= 0) return;
    if (row.status !== "en_curso" && row.status !== "programada") return;
    try {
      const updated = await patchVisitNotes(row.id, text);
      setCurrent((prev) => {
        const next = { ...prev, field_notes: updated.field_notes };
        onUpdated(next);
        return next;
      });
    } catch {
      /* queda en el teléfono */
    }
  }

  function onFieldLogChange(text: string) {
    setFieldLog(text);
    fieldLogRef.current = text;
    writeVisitLog(current.id, text, current.local_uuid);
    if (logTimer.current) window.clearTimeout(logTimer.current);
    logTimer.current = window.setTimeout(() => {
      void pushFieldLog(text);
    }, 700);
  }

  async function flushFieldLog() {
    if (logTimer.current) window.clearTimeout(logTimer.current);
    await pushFieldLog(fieldLogRef.current);
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
      await flushFieldLog();
      const updated = await cancelVisit(current.id, { description: "Cancelada" });
      setCurrent({ ...updated, field_notes: fieldLogRef.current || updated.field_notes });
      setConfirmCancel(false);
      clearVisitWork();
      clearVisitSaleDraft();
      onUpdated({ ...updated, field_notes: fieldLogRef.current || updated.field_notes });
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo cancelar la visita");
    } finally {
      setBusy(false);
    }
  }

  const canCancel =
    !sale && (current.status === "programada" || current.status === "en_curso");

  function dismissFicha() {
    if (current.status === "en_curso") {
      saveVisitWork({
        visitId: current.id,
        selling: selling || hasVisitSaleDraft(current.id),
        clientName: clientName,
      });
    }
    onClose();
  }

  const overlayOpen = closing || selling || showMap || viewSaleDoc || gpsConfirm || showClient;
  const routeNote = rewriteCloseNote(current.description, sale);
  const logLines = visitLogLines(fieldLog);
  const showLiveLog = current.status === "en_curso";

  return (
    <>
      <Modal
        open={open && !overlayOpen}
        onClose={dismissFicha}
        eyebrow="Visita"
        title={statusTitle}
        footer={
          <div className="side-sheet-actions visit-ficha-actions">
            <Button type="button" variant="ghost" onClick={dismissFicha}>
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
              <Button type="button" variant="accent" disabled={busy} onClick={onAskHere}>
                <Play size={16} />
                Iniciar
              </Button>
            ) : null}
            {current.status === "en_curso" && !sale ? (
              <Button
                type="button"
                variant="accent"
                onClick={() => {
                  void flushFieldLog();
                  saveVisitWork({
                    visitId: current.id,
                    selling: true,
                    clientName,
                  });
                  setSelling(true);
                }}
              >
                <ShoppingCart size={16} />
                Registrar venta
              </Button>
            ) : null}
            {current.status === "en_curso" ? (
              <Button
                type="button"
                variant={sale ? "accent" : "secondary"}
                onClick={() => {
                  void flushFieldLog();
                  setCurrent((prev) => ({ ...prev, field_notes: fieldLogRef.current }));
                  setClosing(true);
                }}
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
            <button
              type="button"
              className="visit-ficha-hit"
              onClick={() => current.client && setShowClient(true)}
              disabled={!current.client}
            >
              <span className="visit-ficha-avatar" aria-hidden>
                {initials(clientName)}
              </span>
              <div className="visit-ficha-id-copy">
                <p className="eyebrow">Punto de venta</p>
                <strong>{clientName}</strong>
                <span className="muted small">
                  {clientId ?? "Sin RIF/CI"}
                  {current.client?.city ? ` · ${current.client.city}` : ""}
                  {current.seller?.full_name ? ` · ${current.seller.full_name}` : ""}
                </span>
                {current.client ? (
                  <span className="visit-ficha-open muted small">Tocar para ficha y dirección</span>
                ) : null}
              </div>
            </button>
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
            {stayLabel ? (
              <div className="visit-detail-hero-stay">
                <p className="eyebrow">Duración</p>
                <strong>{stayLabel}</strong>
              </div>
            ) : null}
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
                    <b>{formatSaleTotal(sale)}</b>
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

          {current.scheduled_date ? (
            <div className="visit-ficha-facts">
              <article className="visit-ficha-fact">
                <span className="muted small">
                  <Calendar size={12} /> Agenda
                </span>
                <strong>
                  {current.scheduled_date}
                  {timeLabel ? ` · ${timeLabel}` : ""}
                </strong>
              </article>
            </div>
          ) : null}

          {showLiveLog ? (
            <section className="visit-log-live" aria-label="Bitácora de la visita">
              <TextAreaField
                id={`visit-log-${current.id}`}
                label="Bitácora"
                hint="Anota lo que vas capturando. Cada línea se vuelve un punto. Queda en el teléfono aunque se cierre la ficha."
                value={fieldLog}
                onChange={(e) => onFieldLogChange(e.target.value)}
                placeholder="Llegué · hablé con… · revisó inventario… · pidió cotización…"
                className="input-area is-visit-log"
                rows={8}
              />
              {logLines.length ? (
                <ul className="visit-log-bullets">
                  {logLines.map((line, i) => (
                    <li key={`${i}-${line.slice(0, 24)}`}>{line}</li>
                  ))}
                </ul>
              ) : null}
            </section>
          ) : logLines.length ? (
            <section className="visit-note-card" aria-label="Bitácora de la visita">
              <p className="eyebrow">
                <StickyNote size={12} aria-hidden /> Bitácora
              </p>
              <ul className="visit-log-bullets">
                {logLines.map((line, i) => (
                  <li key={`${i}-${line.slice(0, 24)}`}>{line}</li>
                ))}
              </ul>
            </section>
          ) : routeNote ? (
            <section className="visit-note-card" aria-label="Nota de la visita">
              <p className="eyebrow">
                <StickyNote size={12} aria-hidden /> Nota de ruta
              </p>
              <p>{routeNote}</p>
            </section>
          ) : null}

          {current.status !== "programada" ? (
            <VisitGpsEvidence
              visit={current}
              hasGps={hasGps}
              canPinGps={canPinGps}
              gpsBusy={gpsBusy}
              gpsOk={gpsOk}
              onPinGps={() => void onPinGps()}
              onShowMap={() => setShowMap(true)}
            />
          ) : null}

          {error ? (
            <p className="form-error" role="alert">
              {error}
            </p>
          ) : null}
        </div>
      </Modal>

      {current.client && showClient ? (
        <ClientDetailSheet
          client={current.client}
          open
          sellerLabel={current.seller?.full_name ?? user?.full_name ?? undefined}
          onClose={() => setShowClient(false)}
        />
      ) : null}

      {selling ? (
        <VisitSaleWizard
          visit={current}
          open
          onClose={() => {
            saveVisitWork({
              visitId: current.id,
              selling: hasVisitSaleDraft(current.id),
              clientName,
            });
            setSelling(false);
          }}
          onSold={(saleOut) => {
            const updated: Visit = { ...current, sale: saleOut, field_notes: fieldLogRef.current };
            setCurrent(updated);
            setSaleJustConfirmed(true);
            setSelling(false);
            saveVisitWork({
              visitId: current.id,
              selling: false,
              clientName,
            });
            onUpdated(updated);
          }}
        />
      ) : null}

      {closing ? (
        <CloseVisitSheet
          visit={{ ...current, field_notes: fieldLog }}
          open
          onClose={() => setClosing(false)}
          onGoRegisterSale={() => {
            setClosing(false);
            setSelling(true);
          }}
          onClosed={(updated) => {
            const next = { ...updated, field_notes: updated.field_notes ?? fieldLogRef.current };
            setCurrent(next);
            setFieldLog(next.field_notes ?? fieldLogRef.current);
            setClosing(false);
            clearVisitWork();
            clearVisitSaleDraft();
            onUpdated(next);
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
          fromVisit
          onClose={() => setViewSaleDoc(false)}
        />
      ) : null}

      {showMap || gpsConfirm ? (
        <VisitMapSheet
          visit={current}
          open
          eyebrow={gpsConfirm ? "Confirmar posición" : undefined}
          blurb={gpsConfirm ? `¿Estás en ${clientName}?` : undefined}
          notice={
            gpsConfirm && (gpsConfirmNote || error) ? (
              <p className="visit-gps-span is-warn" role="status">
                {error ?? gpsConfirmNote}
              </p>
            ) : null
          }
          footer={
            gpsConfirm ? (
              current.status === "programada" ? (
                <div className="side-sheet-actions">
                  <Button
                    type="button"
                    variant="accent"
                    disabled={busy}
                    onClick={() => void onStart()}
                  >
                    {busy ? "Iniciando…" : "Sí, estoy aquí"}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    disabled={busy}
                    onClick={() => void onStart({ skipGps: true })}
                  >
                    Continuar sin GPS
                  </Button>
                </div>
              ) : (
                <div className="side-sheet-actions">
                  <Button
                    type="button"
                    variant={hasGps ? "accent" : "ghost"}
                    disabled={gpsBusy}
                    onClick={dismissHerePrompt}
                  >
                    {hasGps ? "Sí, estoy aquí" : "Continuar sin GPS"}
                  </Button>
                  {canPinGps ? (
                    <Button
                      type="button"
                      variant="secondary"
                      disabled={gpsBusy}
                      onClick={() => void onPinGps()}
                    >
                      <Crosshair size={16} />
                      {gpsBusy ? "Actualizando…" : "Actualizar GPS"}
                    </Button>
                  ) : null}
                </div>
              )
            ) : undefined
          }
          onClose={() => {
            setShowMap(false);
            if (gpsConfirm && current.status === "en_curso") {
              dismissHerePrompt();
            } else {
              setGpsConfirm(false);
            }
          }}
        />
      ) : null}
    </>
  );
}
