import { Clock, Crosshair, MapPin } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { Button } from "./Button";
import { Modal } from "./Modal";
import { PhotoDrop } from "./PhotoDrop";
import { TextField } from "./TextField";
import { VisitMapSheet } from "./VisitMapSheet";
import { ApiError, closeVisit, pinVisitGps, type VisitCloseInput } from "../lib/api";
import { coordsFromClient, getCurrentPosition, GPS_ACCURACY_WARN_M } from "../lib/gps";
import { removeLocalVisit } from "../lib/offlineDb";
import { enqueueCloseVisit, enqueueOfflineVisitSync } from "../lib/offlineQueue";
import { formatDateTime } from "../lib/caracasTime";
import type { Visit } from "../lib/types";

type Props = {
  visit: Visit;
  open: boolean;
  onClose: () => void;
  onClosed: (visit: Visit) => void;
  /** Si no hay OV: volver a la ficha para registrar venta. */
  onGoRegisterSale?: () => void;
  /** Si se actualiza el GPS antes de cerrar, avisar a la ficha/lista. */
  onVisitPatched?: (visit: Visit) => void;
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
  const start = Date.parse(startedIso);
  if (Number.isNaN(start)) return "—";
  const ms = Math.max(0, ended.getTime() - start);
  const totalMin = Math.round(ms / 60_000);
  if (totalMin < 1) return "menos de 1 min";
  const hours = Math.floor(totalMin / 60);
  const minutes = totalMin % 60;
  if (hours === 0) return `${minutes} min`;
  if (minutes === 0) return `${hours} h`;
  return `${hours} h ${minutes} min`;
}

function existingGpsFields(visit: Visit): Partial<VisitCloseInput> {
  return {
    latitude: Number(visit.latitude),
    longitude: Number(visit.longitude),
    gps_accuracy_m: visit.gps_accuracy_m != null ? Number(visit.gps_accuracy_m) : null,
    gps_offline: Boolean(visit.gps_offline),
    gps_captured_at: visit.gps_captured_at,
    gps_skipped: false,
  };
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
 * Cierre de visita: evidencia solo si falta GPS.
 * La venta se registra antes, en la visita abierta — aquí no se cotiza de nuevo.
 */
export function CloseVisitSheet({
  visit,
  open,
  onClose,
  onClosed,
  onGoRegisterSale,
  onVisitPatched,
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

  useEffect(() => {
    if (!open) return;
    setDraft(visit);
    setPhase(visit.sale ? "close" : "warn");
    setNotes("");
    setSkipGps(false);
    setSkipReason("Sin señal / GPS no disponible");
    setPhotoDataUrl(null);
    setAccuracyWarn(null);
    setError(null);
    setShowMap(false);
  }, [open, visit.id, visit.sale]);

  const existingSale = draft.sale ?? visit.sale ?? null;
  const hasGps = visitHasGpsFix(draft);

  if (!open) return null;

  function applyGpsToDraft(next: Visit) {
    setDraft(next);
    onVisitPatched?.(next);
  }

  async function refreshGps() {
    setGpsBusy(true);
    setError(null);
    setAccuracyWarn(null);
    try {
      const geo = await getCurrentPosition(15_000, coordsFromClient(draft.client));
      if (!geo.ok) {
        setError(geo.reason);
        return;
      }
      const acc = geo.fix.accuracy_m;
      if (acc != null && acc > GPS_ACCURACY_WARN_M) {
        setAccuracyWarn(
          `GPS poco preciso (±${Math.round(acc)} m). Puedes confirmar o volver a actualizar.`,
        );
      }
      if (draft.id > 0 && navigator.onLine) {
        const updated = await pinVisitGps(draft.id, {
          latitude: geo.fix.latitude,
          longitude: geo.fix.longitude,
          gps_accuracy_m: geo.fix.accuracy_m,
          gps_offline: Boolean(geo.fix.mocked),
        });
        applyGpsToDraft(updated);
      } else {
        applyGpsToDraft({
          ...draft,
          latitude: String(geo.fix.latitude),
          longitude: String(geo.fix.longitude),
          gps_accuracy_m: acc != null ? String(acc) : draft.gps_accuracy_m,
          gps_captured_at: geo.fix.captured_at,
          gps_offline: Boolean(geo.fix.mocked),
        });
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo actualizar el GPS");
    } finally {
      setGpsBusy(false);
    }
  }

  async function submitClose(result: "sin_venta" | "venta_cerrada") {
    setError(null);
    setAccuracyWarn(null);

    if (!hasGps && skipGps && !photoDataUrl) {
      setError("Si omites el GPS, adjunta una foto del PDV");
      return;
    }
    if (!hasGps && skipGps && !skipReason.trim()) {
      setError("Indica el motivo de omitir el GPS");
      return;
    }

    setSubmitting(true);
    try {
      let gpsFields: Partial<VisitCloseInput>;

      if (hasGps) {
        gpsFields = existingGpsFields(draft);
        if (photoDataUrl) gpsFields.photo_evidence = photoDataUrl;
      } else if (skipGps) {
        gpsFields = {
          gps_offline: true,
          gps_skipped: true,
          gps_skip_reason: skipReason.trim(),
          photo_evidence: photoDataUrl,
        };
      } else {
        const geo = await getCurrentPosition(15_000, coordsFromClient(draft.client));
        if (geo.ok) {
          const acc = geo.fix.accuracy_m;
          if (acc != null && acc > GPS_ACCURACY_WARN_M) {
            setAccuracyWarn(
              `GPS poco preciso (±${Math.round(acc)} m). Se guardará con alerta para el supervisor.`,
            );
          }
          gpsFields = {
            latitude: geo.fix.latitude,
            longitude: geo.fix.longitude,
            gps_accuracy_m: geo.fix.accuracy_m,
            gps_offline: false,
            gps_captured_at: geo.fix.captured_at,
            gps_skipped: false,
          };
        } else if (photoDataUrl) {
          gpsFields = {
            gps_offline: true,
            gps_skipped: true,
            gps_skip_reason: skipReason.trim() || geo.reason,
            photo_evidence: photoDataUrl,
          };
        } else {
          setError(`${geo.reason}. Adjunta una foto o activa GPS de prueba.`);
          setSubmitting(false);
          return;
        }
      }

      if (photoDataUrl && !gpsFields.photo_evidence) {
        gpsFields.photo_evidence = photoDataUrl;
      }

      const payload: VisitCloseInput = {
        result,
        description:
          notes.trim() ||
          (existingSale
            ? `Cierre con OV-${existingSale.id}`
            : "Cerrada sin venta"),
        ...gpsFields,
      };

      const finished: Visit = {
        ...draft,
        status: "completada",
        result: payload.result,
        description: payload.description ?? visit.description,
        latitude: payload.latitude != null ? String(payload.latitude) : visit.latitude,
        longitude: payload.longitude != null ? String(payload.longitude) : visit.longitude,
        gps_accuracy_m:
          payload.gps_accuracy_m != null
            ? String(payload.gps_accuracy_m)
            : visit.gps_accuracy_m,
        gps_offline: Boolean(payload.gps_offline),
      };

      const offlineOrLocal = !navigator.onLine || isLocalPendingVisit(visit);

      if (offlineOrLocal && isLocalPendingVisit(visit) && visit.local_uuid) {
        await enqueueOfflineVisitSync({
          local_uuid: visit.local_uuid,
          client_id: visit.client_id,
          description: payload.description,
          result: payload.result,
          latitude: payload.latitude ?? null,
          longitude: payload.longitude ?? null,
          gps_accuracy_m: payload.gps_accuracy_m ?? null,
          gps_captured_at: payload.gps_captured_at ?? new Date().toISOString(),
          visited_at: new Date().toISOString(),
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
  const gpsLabel = hasGps
    ? `${Number(draft.latitude).toFixed(5)}, ${Number(draft.longitude).toFixed(5)}`
    : null;

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
            <strong>No hay OV registrada</strong>
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
      blurb={
        existingSale
          ? `OV-${existingSale.id}${hasGps ? " · GPS ya capturado" : " · falta evidencia GPS"}`
          : hasGps
            ? "Cierre sin venta · GPS ya capturado"
            : "Cierre sin venta · falta GPS"
      }
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
            {submitting ? "Cerrando…" : gpsBusy ? "Actualizando GPS…" : "Confirmar cierre"}
          </Button>
        </div>
      }
    >
      <form id="close-visit-form" className="sheet-form-stack" onSubmit={(e) => void onSubmit(e)}>
        <CloseTimeSummary visit={draft} />

        {existingSale ? (
          <div className="visit-sale-confirmed" role="status">
            <div className="visit-sale-confirmed-copy">
              <p className="eyebrow">Orden de venta</p>
              <strong>OV-{existingSale.id}</strong>
              <p className="muted small">
                ${Number(existingSale.total_amount).toFixed(2)} {existingSale.currency}
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

        {hasGps ? (
          <section className="visit-gps-card has-fix">
            <div className="visit-gps-copy">
              <p className="eyebrow">
                <MapPin size={12} aria-hidden /> GPS en esta visita
              </p>
              <strong>{gpsLabel}</strong>
              <span className="muted small">
                {draft.gps_accuracy_m
                  ? `±${Number(draft.gps_accuracy_m).toFixed(0)} m`
                  : "Precisión no reportada"}
                {draft.gps_offline ? " · prueba / offline" : ""}
                . Revisa el mapa o actualiza el punto si no coincide.
              </span>
            </div>
            <div className="visit-gps-actions">
              <Button type="button" variant="secondary" onClick={() => setShowMap(true)}>
                <MapPin size={16} />
                Ver mapa
              </Button>
              <Button
                type="button"
                variant="secondary"
                disabled={gpsBusy || submitting}
                onClick={() => void refreshGps()}
              >
                <Crosshair size={16} />
                {gpsBusy ? "Actualizando…" : "Actualizar GPS"}
              </Button>
            </div>
          </section>
        ) : (
          <>
            <section className="visit-gps-card needs-fix">
              <div className="visit-gps-copy">
                <p className="eyebrow">Evidencia GPS</p>
                <strong>Esta visita no tiene coordenada</strong>
                <span className="muted small">
                  Al confirmar se intentará capturar el GPS. Si no hay señal, omite y adjunta
                  foto del PDV.
                </span>
              </div>
              <label className="check-row">
                <input
                  type="checkbox"
                  checked={skipGps}
                  onChange={(e) => setSkipGps(e.target.checked)}
                />
                Omitir GPS (requiere foto)
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

            <PhotoDrop
              id="visit-photo"
              label={skipGps ? "Foto del PDV (obligatoria)" : "Foto del PDV (si falla el GPS)"}
              hint={skipGps ? "Obligatoria · galería o cámara · JPG o PNG" : "Opcional · galería o cámara · JPG o PNG"}
              readyHint="Evidencia de cierre"
              value={photoDataUrl}
              disabled={submitting}
              onChange={setPhotoDataUrl}
            />
          </>
        )}

        <TextField
          id="close-notes"
          label="Nota (opcional)"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
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
