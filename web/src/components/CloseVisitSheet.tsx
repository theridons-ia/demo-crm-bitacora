import { useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import { Button } from "./Button";
import { Modal } from "./Modal";
import { TextField } from "./TextField";
import { ApiError, closeVisit, type VisitCloseInput } from "../lib/api";
import { getCurrentPosition, GPS_ACCURACY_WARN_M } from "../lib/gps";
import { fileToCompressedDataUrl } from "../lib/imageEvidence";
import { removeLocalVisit } from "../lib/offlineDb";
import { enqueueCloseVisit, enqueueOfflineVisitSync } from "../lib/offlineQueue";
import type { Visit } from "../lib/types";

type Props = {
  visit: Visit;
  open: boolean;
  onClose: () => void;
  onClosed: (visit: Visit) => void;
  /** Si no hay OV: volver a la ficha para registrar venta. */
  onGoRegisterSale?: () => void;
};

function isLocalPendingVisit(visit: Visit): boolean {
  return visit.id < 0 || Boolean(visit.local_uuid?.startsWith("local-"));
}

/**
 * Cierre de visita: solo evidencia GPS/foto.
 * La venta se registra antes, en la visita abierta — aquí no se cotiza de nuevo.
 */
export function CloseVisitSheet({
  visit,
  open,
  onClose,
  onClosed,
  onGoRegisterSale,
}: Props) {
  const existingSale = visit.sale ?? null;
  const [phase, setPhase] = useState<"warn" | "close">(
    existingSale ? "close" : "warn",
  );
  const [notes, setNotes] = useState("");
  const [skipGps, setSkipGps] = useState(false);
  const [skipReason, setSkipReason] = useState("Sin señal / GPS no disponible");
  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [accuracyWarn, setAccuracyWarn] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setPhase(visit.sale ? "close" : "warn");
    setNotes("");
    setSkipGps(false);
    setSkipReason("Sin señal / GPS no disponible");
    setPhotoDataUrl(null);
    setAccuracyWarn(null);
    setError(null);
  }, [open, visit.sale]);

  if (!open) return null;

  async function onPhotoChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      setPhotoDataUrl(null);
      return;
    }
    setPhotoBusy(true);
    setError(null);
    try {
      setPhotoDataUrl(await fileToCompressedDataUrl(file));
    } catch (err) {
      setPhotoDataUrl(null);
      setError(err instanceof Error ? err.message : "No se pudo leer la foto");
    } finally {
      setPhotoBusy(false);
    }
  }

  async function submitClose(result: "sin_venta" | "venta_cerrada") {
    setError(null);
    setAccuracyWarn(null);

    if (skipGps && !photoDataUrl) {
      setError("Si omites el GPS, espera a que diga «Foto lista» y vuelve a confirmar");
      return;
    }
    if (skipGps && !skipReason.trim()) {
      setError("Indica el motivo de omitir el GPS");
      return;
    }
    if (photoBusy) {
      setError("Espera a que termine de procesar la foto");
      return;
    }

    setSubmitting(true);
    try {
      let gpsFields: Partial<VisitCloseInput> = { gps_offline: true, gps_skipped: true };

      if (!skipGps) {
        const geo = await getCurrentPosition();
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
        } else {
          if (!photoDataUrl) {
            setError(`${geo.reason}. Adjunta foto o usa HTTPS para GPS.`);
            setSubmitting(false);
            return;
          }
          gpsFields = {
            gps_offline: true,
            gps_skipped: true,
            gps_skip_reason: skipReason.trim() || geo.reason,
            photo_evidence: photoDataUrl,
          };
        }
      } else {
        gpsFields = {
          gps_offline: true,
          gps_skipped: true,
          gps_skip_reason: skipReason.trim(),
          photo_evidence: photoDataUrl,
        };
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
        ...visit,
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

  const clientName = visit.client?.name ?? `Cliente #${visit.client_id}`;
  const itemCount = existingSale?.items?.length ?? 0;

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
    <Modal
      open={open}
      onClose={onClose}
      eyebrow="Cerrar visita"
      title={clientName}
      blurb={
        existingSale
          ? `OV-${existingSale.id} · evidencia de cierre`
          : "Cierre sin venta · evidencia GPS / foto"
      }
      footer={
        <div className="side-sheet-actions">
          <Button type="button" variant="ghost" disabled={submitting || photoBusy} onClick={onClose}>
            Cancelar
          </Button>
          <Button
            type="submit"
            form="close-visit-form"
            variant="accent"
            disabled={submitting || photoBusy}
          >
            {submitting ? "Cerrando…" : photoBusy ? "Procesando foto…" : "Confirmar cierre"}
          </Button>
        </div>
      }
    >
      <form id="close-visit-form" className="sheet-form-stack" onSubmit={(e) => void onSubmit(e)}>
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
            Confirmaste cerrar <strong>sin venta</strong>. Solo falta la evidencia.
          </p>
        )}

        <div className="field">
          <span className="field-label">Evidencia GPS</span>
          <label className="check-row">
            <input
              type="checkbox"
              checked={skipGps}
              onChange={(e) => setSkipGps(e.target.checked)}
            />
            Omitir GPS (requiere foto)
          </label>
          <p className="muted small">
            En el celular elige ubicación <strong>precisa</strong> si el sistema lo pregunta.
          </p>
        </div>

        {skipGps ? (
          <TextField
            id="skip-reason"
            label="Motivo de omitir GPS"
            value={skipReason}
            onChange={(e) => setSkipReason(e.target.value)}
            required
          />
        ) : null}

        <div className="field">
          <label htmlFor="visit-photo">Foto del PDV {skipGps ? "(obligatoria)" : "(opcional)"}</label>
          <input
            id="visit-photo"
            className="input"
            type="file"
            accept="image/*"
            capture="environment"
            onChange={onPhotoChange}
          />
          {photoBusy ? <p className="muted small">Comprimiendo foto…</p> : null}
          {photoDataUrl && !photoBusy ? (
            <p className="gps-ok-note" style={{ marginTop: "0.5rem" }}>
              Foto lista para enviar
            </p>
          ) : null}
        </div>

        <TextField
          id="close-notes"
          label="Nota"
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
  );
}
