import { Clock, Crosshair, MapPin } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Button } from "./Button";
import { Modal } from "./Modal";
import { PhotoDrop } from "./PhotoDrop";
import { TextAreaField, TextField } from "./TextField";
import { VisitMapSheet } from "./VisitMapSheet";
import { ApiError, closeVisit, type VisitCloseInput } from "../lib/api";
import {
  coordsFromClient,
  getCurrentPosition,
  GPS_ACCURACY_WARN_M,
  type GeoFix,
} from "../lib/gps";
import { removeLocalVisit } from "../lib/offlineDb";
import { enqueueCloseVisit, enqueueOfflineVisitSync } from "../lib/offlineQueue";
import { formatDateTime, formatDurationHm } from "../lib/caracasTime";
import { formatSaleTotal, saleOrderCode, visitNoteForUi } from "../lib/saleLabels";
import { resolveVisitLog, writeVisitLog } from "../lib/visitFieldLog";
import type { Visit } from "../lib/types";

type Props = {
  visit: Visit;
  open: boolean;
  onClose: () => void;
  onClosed: (visit: Visit) => void;
  /** Si no hay pedido: volver a la ficha para registrar pedido. */
  onGoRegisterSale?: () => void;
};

function isLocalPendingVisit(visit: Visit): boolean {
  return visit.id < 0 || Boolean(visit.local_uuid?.startsWith("local-"));
}

function visitHasGpsFix(visit: Visit): boolean {
  const lat = visit.latitude != null && visit.latitude !== "" ? Number(visit.latitude) : NaN;
  const lng = visit.longitude != null && visit.longitude !== "" ? Number(visit.longitude) : NaN;
  return Number.isFinite(lat) && Number.isFinite(lng);
}

function formatClock(iso: string | null | undefined): string {
  return formatDateTime(iso);
}

function formatStay(startedIso: string, ended: Date): string {
  return formatDurationHm(startedIso, ended) ?? "—";
}

function formatFix(fix: { latitude: number; longitude: number; accuracy_m?: number | null }): string {
  return `${fix.latitude.toFixed(5)}, ${fix.longitude.toFixed(5)}`;
}

function CloseTimeSummary({ visit }: { visit: Visit }) {
  const startedIso = visit.visited_at || visit.created_at;
  const closingAt = new Date();
  return (
    <section className="visit-close-time" aria-label="Tiempo en el PDV">
      <p className="eyebrow">
        <Clock size={12} aria-hidden /> Tiempo en el PDV
      </p>
      <div className="visit-close-time-grid">
        <div>
          <span className="muted small">Hora iniciada</span>
          <strong>{formatClock(startedIso)}</strong>
        </div>
        <div>
          <span className="muted small">Hora de cierre</span>
          <strong>{formatClock(closingAt.toISOString())}</strong>
        </div>
      </div>
      <p className="visit-close-time-stay">
        Duración <strong>{formatStay(startedIso, closingAt)}</strong>
      </p>
    </section>
  );
}

/**
 * Cierre de visita: captura GPS de cierre (distinto del de inicio).
 * La venta se registra antes, en la visita abierta — aquí no se cotiza de nuevo.
 */
export function CloseVisitSheet({
  visit,
  open,
  onClose,
  onClosed,
  onGoRegisterSale,
}: Props) {
  const [draft, setDraft] = useState(visit);
  const [phase, setPhase] = useState<"warn" | "close">(
    visit.sale ? "close" : "warn",
  );
  const [notes, setNotes] = useState("");
  const [skipGps, setSkipGps] = useState(false);
  const [skipReason, setSkipReason] = useState("Sin señal / GPS no disponible");
  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(null);
  const [accuracyWarn, setAccuracyWarn] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [gpsBusy, setGpsBusy] = useState(false);
  const [showMap, setShowMap] = useState(false);
  const [closeFix, setCloseFix] = useState<GeoFix | null>(null);
  const [closeGpsError, setCloseGpsError] = useState<string | null>(null);
  const closeGpsStarted = useRef(false);

  useEffect(() => {
    if (!open) return;
    setDraft(visit);
    setPhase(visit.sale ? "close" : "warn");
    setNotes(
      resolveVisitLog(
        visit.id,
        visit.field_notes || visitNoteForUi(visit.description),
        visit.local_uuid,
      ),
    );
    setSkipGps(false);
    setSkipReason("Sin señal / GPS no disponible");
    setPhotoDataUrl(null);
    setAccuracyWarn(null);
    setError(null);
    setShowMap(false);
    setCloseFix(null);
    setCloseGpsError(null);
    closeGpsStarted.current = false;
  }, [open, visit.id, visit.sale]);

  const existingSale = draft.sale ?? visit.sale ?? null;
  const hasStartGps = visitHasGpsFix(draft);

  async function captureCloseGps() {
    setGpsBusy(true);
    setError(null);
    setCloseGpsError(null);
    setAccuracyWarn(null);
    try {
      const geo = await getCurrentPosition(
        15_000,
        coordsFromClient(draft.client),
        { maximumAge: 0 },
      );
      if (!geo.ok) {
        setCloseGpsError(geo.reason);
        return;
      }
      setCloseFix(geo.fix);
      const acc = geo.fix.accuracy_m;
      if (acc != null && acc > GPS_ACCURACY_WARN_M) {
        setAccuracyWarn(
          `GPS de cierre poco preciso (±${Math.round(acc)} m). Puedes confirmar o volver a capturar.`,
        );
      }
    } catch {
      setCloseGpsError("No se pudo obtener el GPS de cierre");
    } finally {
      setGpsBusy(false);
    }
  }

  useEffect(() => {
    if (!open || phase !== "close") return;
    if (closeGpsStarted.current) return;
    closeGpsStarted.current = true;
    void captureCloseGps();
  }, [open, phase]);

  if (!open) return null;

  async function submitClose(result: "sin_venta" | "venta_cerrada") {
    setError(null);
    setAccuracyWarn(null);

    if (skipGps && !photoDataUrl) {
      setError("Si omites el GPS de cierre, adjunta una foto del PDV");
      return;
    }
    if (skipGps && !skipReason.trim()) {
      setError("Indica el motivo de omitir el GPS");
      return;
    }

    setSubmitting(true);
    try {
      let gpsFields: Partial<VisitCloseInput>;
      let usedFix: GeoFix | null = skipGps ? null : closeFix;

      if (skipGps) {
        gpsFields = {
          gps_offline: true,
          gps_skipped: true,
          gps_skip_reason: skipReason.trim(),
          photo_evidence: photoDataUrl,
        };
      } else {
        if (!usedFix) {
          const geo = await getCurrentPosition(
            15_000,
            coordsFromClient(draft.client),
            { maximumAge: 0 },
          );
          if (geo.ok) {
            usedFix = geo.fix;
            setCloseFix(geo.fix);
          } else if (photoDataUrl) {
            gpsFields = {
              gps_offline: true,
              gps_skipped: true,
              gps_skip_reason: skipReason.trim() || geo.reason,
              photo_evidence: photoDataUrl,
            };
          } else {
            setCloseGpsError(geo.reason);
            setError(`${geo.reason}. Adjunta una foto o activa GPS de prueba.`);
            setSubmitting(false);
            return;
          }
        }

        if (usedFix) {
          const acc = usedFix.accuracy_m;
          if (acc != null && acc > GPS_ACCURACY_WARN_M) {
            setAccuracyWarn(
              `GPS de cierre poco preciso (±${Math.round(acc)} m). Se guardará con alerta para el supervisor.`,
            );
          }
          gpsFields = {
            latitude: usedFix.latitude,
            longitude: usedFix.longitude,
            gps_accuracy_m: usedFix.accuracy_m,
            gps_offline: Boolean(usedFix.mocked),
            gps_captured_at: usedFix.captured_at,
            gps_skipped: false,
          };
        }
      }

      if (photoDataUrl && gpsFields! && !gpsFields.photo_evidence) {
        gpsFields.photo_evidence = photoDataUrl;
      }

      const payload: VisitCloseInput = {
        result,
        field_notes: notes.trim() || null,
        ...gpsFields!,
      };

      const closedAt = new Date().toISOString();
      const finished: Visit = {
        ...draft,
        status: "completada",
        result: payload.result,
        description: payload.description ?? visit.description,
        field_notes: payload.field_notes ?? visit.field_notes,
        closed_at: closedAt,
        end_latitude: payload.latitude != null ? String(payload.latitude) : null,
        end_longitude: payload.longitude != null ? String(payload.longitude) : null,
        end_gps_accuracy_m:
          payload.gps_accuracy_m != null ? String(payload.gps_accuracy_m) : null,
        end_gps_captured_at: payload.gps_captured_at ?? closedAt,
        gps_offline: Boolean(payload.gps_offline),
        gps_skipped: payload.gps_skipped,
        gps_skip_reason: payload.gps_skip_reason ?? null,
        photo_evidence: payload.photo_evidence ?? draft.photo_evidence,
      };

      const offlineOrLocal = !navigator.onLine || isLocalPendingVisit(visit);

      if (offlineOrLocal && isLocalPendingVisit(visit) && visit.local_uuid) {
        await enqueueOfflineVisitSync({
          local_uuid: visit.local_uuid,
          client_id: visit.client_id,
          description: payload.description,
          field_notes: payload.field_notes,
          result: payload.result,
          latitude: draft.latitude != null ? Number(draft.latitude) : null,
          longitude: draft.longitude != null ? Number(draft.longitude) : null,
          gps_accuracy_m: draft.gps_accuracy_m != null ? Number(draft.gps_accuracy_m) : null,
          gps_captured_at: draft.gps_captured_at ?? visit.visited_at ?? visit.created_at,
          visited_at: visit.visited_at || visit.created_at,
          end_latitude: payload.latitude ?? null,
          end_longitude: payload.longitude ?? null,
          end_gps_accuracy_m: payload.gps_accuracy_m ?? null,
          end_gps_captured_at: payload.gps_captured_at ?? closedAt,
          gps_skipped: payload.gps_skipped ?? false,
          gps_skip_reason: payload.gps_skip_reason ?? null,
          photo_evidence: payload.photo_evidence ?? null,
          sale: null,
        });
        await removeLocalVisit(visit.local_uuid);
      } else if (!navigator.onLine) {
        await enqueueCloseVisit(visit.id, payload);
      } else {
        try {
          const updated = await closeVisit(visit.id, payload);
          onClosed(updated);
          onClose();
          return;
        } catch (err) {
          if (err instanceof ApiError && err.status >= 500) throw err;
          if (!navigator.onLine || err instanceof TypeError) {
            await enqueueCloseVisit(visit.id, payload);
          } else {
            throw err;
          }
        }
      }

      onClosed(finished);
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo cerrar la visita");
    } finally {
      setSubmitting(false);
    }
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    await submitClose(existingSale ? "venta_cerrada" : "sin_venta");
  }

  const clientName = draft.client?.name ?? visit.client?.name ?? `Cliente #${visit.client_id}`;
  const itemCount = existingSale?.items?.length ?? 0;
  const startLabel = hasStartGps
    ? `${Number(draft.latitude).toFixed(5)}, ${Number(draft.longitude).toFixed(5)}`
    : null;
  const closeReady = Boolean(closeFix) && !skipGps;
  const blurb = existingSale
    ? `${saleOrderCode(existingSale)}${closeReady ? " · GPS de cierre listo" : " · capturando GPS de cierre"}`
    : closeReady
      ? "Cierre sin venta · GPS de cierre listo"
      : "Cierre sin venta · GPS de cierre";

  if (phase === "warn" && !existingSale) {
    return (
      <Modal
        open={open}
        onClose={onClose}
        eyebrow="Cerrar visita"
        title={clientName}
        blurb="Esta visita aún no tiene orden de venta"
        footer={
          <div className="side-sheet-actions">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancelar
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                onClose();
                onGoRegisterSale?.();
              }}
            >
              Registrar venta
            </Button>
            <Button type="button" variant="accent" onClick={() => setPhase("close")}>
              Cerrar sin venta
            </Button>
          </div>
        }
      >
        <div className="sheet-form-stack">
          <CloseTimeSummary visit={draft} />
          <div className="visit-close-warn" role="status">
            <p className="eyebrow">Advertencia</p>
            <strong>No hay pedido registrada</strong>
            <p className="muted">
              Lo habitual es registrar la venta en la visita abierta y luego cerrar.
              Puedes volver a cotizar o confirmar el cierre sin venta.
            </p>
          </div>
        </div>
      </Modal>
    );
  }

  return (
    <>
    <Modal
      open={open}
      onClose={onClose}
      eyebrow="Cerrar visita"
      title={clientName}
      blurb={blurb}
      footer={
        <div className="side-sheet-actions">
          <Button type="button" variant="ghost" disabled={submitting} onClick={onClose}>
            Cancelar
          </Button>
          <Button
            type="submit"
            form="close-visit-form"
            variant="accent"
            disabled={submitting || gpsBusy}
          >
            {submitting ? "Cerrando…" : gpsBusy ? "Capturando GPS…" : "Confirmar cierre"}
          </Button>
        </div>
      }
    >
      <form id="close-visit-form" className="sheet-form-stack" onSubmit={(e) => void onSubmit(e)}>
        <CloseTimeSummary visit={draft} />

        {existingSale ? (
          <div className="visit-sale-confirmed" role="status">
            <div className="visit-sale-confirmed-copy">
              <p className="eyebrow">Pedido</p>
              <strong>{saleOrderCode(existingSale)}</strong>
              <p className="muted small">
                {formatSaleTotal(existingSale)}
                {" · "}
                {itemCount} ítem{itemCount === 1 ? "" : "s"}
              </p>
            </div>
          </div>
        ) : (
          <p className="muted small" style={{ margin: 0 }}>
            Confirmaste cerrar <strong>sin venta</strong>.
          </p>
        )}

        <section className={`visit-gps-card ${closeReady ? "has-fix" : "needs-fix"}`.trim()}>
          <div className="visit-gps-copy">
            <p className="eyebrow">
              <MapPin size={12} aria-hidden /> GPS de cierre
            </p>
            {closeFix && !skipGps ? (
              <>
                <strong>{formatFix(closeFix)}</strong>
                <span className="muted small">
                  {closeFix.accuracy_m != null
                    ? `±${Math.round(closeFix.accuracy_m)} m`
                    : "Precisión no reportada"}
                  {closeFix.mocked ? " · prueba / offline" : ""}
                  {" · se toma ahora, distinto del inicio"}
                </span>
              </>
            ) : skipGps ? (
              <>
                <strong>GPS de cierre omitido</strong>
                <span className="muted small">Se guardará la foto del PDV como evidencia.</span>
              </>
            ) : gpsBusy ? (
              <>
                <strong>Obteniendo ubicación…</strong>
                <span className="muted small">Fecha y hora de cierre van con este punto.</span>
              </>
            ) : (
              <>
                <strong>Falta el punto de cierre</strong>
                <span className="muted small">
                  {closeGpsError ??
                    "Al confirmar se intentará de nuevo. Si no hay señal, omite y adjunta foto."}
                </span>
              </>
            )}
            {hasStartGps ? (
              <span className="muted small">Inicio: {startLabel}</span>
            ) : (
              <span className="muted small">Esta visita no tenía GPS de inicio.</span>
            )}
          </div>
          <div className="visit-gps-actions">
            {draft.id > 0 || hasStartGps ? (
              <Button type="button" variant="secondary" onClick={() => setShowMap(true)}>
                <MapPin size={16} />
                Ver mapa
              </Button>
            ) : null}
            <Button
              type="button"
              variant="secondary"
              disabled={gpsBusy || submitting || skipGps}
              onClick={() => void captureCloseGps()}
            >
              <Crosshair size={16} />
              {gpsBusy ? "Capturando…" : closeFix ? "Capturar de nuevo" : "Capturar GPS"}
            </Button>
          </div>
          <label className="check-row">
            <input
              type="checkbox"
              checked={skipGps}
              onChange={(e) => setSkipGps(e.target.checked)}
            />
            Omitir GPS de cierre (requiere foto)
          </label>
        </section>

        {skipGps ? (
          <TextField
            id="skip-reason"
            label="Motivo de omitir GPS"
            value={skipReason}
            onChange={(e) => setSkipReason(e.target.value)}
            required
          />
        ) : null}

        {skipGps || closeGpsError || !closeFix ? (
          <PhotoDrop
            id="visit-photo"
            label={skipGps ? "Foto del PDV (obligatoria)" : "Foto del PDV (si falla el GPS)"}
            hint={skipGps ? "Obligatoria · galería o cámara · JPG o PNG" : "Opcional · galería o cámara · JPG o PNG"}
            readyHint="Evidencia de cierre"
            value={photoDataUrl}
            disabled={submitting}
            onChange={setPhotoDataUrl}
          />
        ) : null}

        <TextAreaField
          id="close-notes"
          label="Bitácora"
          hint="Sigue anotando hasta cerrar. Cada línea es un punto. Se guarda en el teléfono."
          value={notes}
          onChange={(e) => {
            const text = e.target.value;
            setNotes(text);
            writeVisitLog(visit.id, text, visit.local_uuid);
          }}
          placeholder="Llegué · hablé con… · prometió pedido…"
          className="input-area is-visit-log"
          rows={7}
        />

        {accuracyWarn ? <p className="gps-ok-note">{accuracyWarn}</p> : null}
        {error ? (
          <p className="form-error" role="alert">
            {error}
          </p>
        ) : null}
      </form>
    </Modal>
    {showMap ? (
      <VisitMapSheet visit={draft} open onClose={() => setShowMap(false)} />
    ) : null}
    </>
  );
}
