import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from "react";
import { Button } from "./Button";
import { TextField } from "./TextField";
import { ApiError, closeVisit, fetchProducts, type VisitCloseInput } from "../lib/api";
import { getCurrentPosition, GPS_ACCURACY_WARN_M } from "../lib/gps";
import { fileToCompressedDataUrl } from "../lib/imageEvidence";
import { newLocalUuid, removeLocalVisit } from "../lib/offlineDb";
import {
  enqueueCloseVisit,
  enqueueOfflineVisitSync,
  getCachedProducts,
} from "../lib/offlineQueue";
import type { CurrencyCode, Product, Visit } from "../lib/types";

type Props = {
  visit: Visit;
  open: boolean;
  onClose: () => void;
  onClosed: (visit: Visit) => void;
};

type QtyMap = Record<number, number>;

function isLocalPendingVisit(visit: Visit): boolean {
  return visit.id < 0 || Boolean(visit.local_uuid?.startsWith("local-"));
}

export function CloseVisitSheet({ visit, open, onClose, onClosed }: Props) {
  const [products, setProducts] = useState<Product[]>([]);
  const [mode, setMode] = useState<"sin_venta" | "con_venta">("sin_venta");
  const [qty, setQty] = useState<QtyMap>({});
  const [currency, setCurrency] = useState<CurrencyCode>("USD");
  const [notes, setNotes] = useState("");
  const [skipGps, setSkipGps] = useState(false);
  const [skipReason, setSkipReason] = useState("Sin señal / GPS no disponible");
  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [accuracyWarn, setAccuracyWarn] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [loadingProducts, setLoadingProducts] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoadingProducts(true);
    (async () => {
      try {
        const data = navigator.onLine ? await fetchProducts() : await getCachedProducts();
        if (!cancelled) setProducts(data.length ? data : await getCachedProducts());
      } catch {
        const cached = await getCachedProducts();
        if (!cancelled) {
          setProducts(cached);
          if (!cached.length) {
            setError("Sin inventario en cache. Conéctate una vez para sincronizar catálogo.");
          }
        }
      } finally {
        if (!cancelled) setLoadingProducts(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open]);

  const lines = useMemo(
    () =>
      products
        .filter((p) => (qty[p.id] ?? 0) > 0)
        .map((p) => ({
          product: p,
          quantity: qty[p.id] ?? 0,
          lineTotal: Number(p.price_usd) * (qty[p.id] ?? 0),
        })),
    [products, qty],
  );

  const total = lines.reduce((sum, line) => sum + line.lineTotal, 0);

  if (!open) return null;

  function setProductQty(productId: number, value: number, maxStock: number) {
    const next = Math.max(0, Math.min(maxStock, value));
    setQty((prev) => ({ ...prev, [productId]: next }));
  }

  async function onPhotoChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      setPhotoDataUrl(null);
      return;
    }
    setPhotoBusy(true);
    setError(null);
    try {
      const dataUrl = await fileToCompressedDataUrl(file);
      setPhotoDataUrl(dataUrl);
    } catch (err) {
      setPhotoDataUrl(null);
      setError(err instanceof Error ? err.message : "No se pudo leer la foto");
    } finally {
      setPhotoBusy(false);
    }
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setAccuracyWarn(null);

    if (mode === "con_venta" && lines.length === 0) {
      setError("Agrega al menos un producto o cierra sin venta");
      return;
    }
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
              `GPS poco preciso (±${Math.round(acc)} m). Se guardará con alerta para el supervisor. En el diálogo del sistema elige «Precise» si puedes.`,
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
          // Falló GPS: exigir foto como skip
          if (!photoDataUrl) {
            setError(`${geo.reason}. Adjunta foto o activa GPS de prueba / HTTPS.`);
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
        result: mode === "sin_venta" ? "sin_venta" : "venta_cerrada",
        description: notes.trim() || (mode === "sin_venta" ? "Cerrada sin venta" : "Venta en visita"),
        ...gpsFields,
      };

      if (mode === "con_venta") {
        payload.sale = {
          origin: "visita",
          currency,
          payment_method: currency === "VES" ? "cash_ves" : "cash_usd",
          items: lines.map((line) => ({
            product_id: line.product.id,
            quantity: line.quantity,
          })),
          local_uuid: newLocalUuid("sale"),
          created_offline: !navigator.onLine,
        };
      }

      const finished: Visit = {
        ...visit,
        status: "completada",
        result: payload.result,
        description: payload.description ?? visit.description,
        latitude:
          payload.latitude != null ? String(payload.latitude) : visit.latitude,
        longitude:
          payload.longitude != null ? String(payload.longitude) : visit.longitude,
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
          sale: payload.sale
            ? {
                ...payload.sale,
                created_offline: true,
              }
            : null,
        });
        await removeLocalVisit(visit.local_uuid);
      } else if (!navigator.onLine) {
        await enqueueCloseVisit(visit.id, payload);
      } else {
        try {
          const updated = await closeVisit(visit.id, payload);
          setQty({});
          setNotes("");
          setMode("sin_venta");
          setSkipGps(false);
          setSkipReason("Sin señal / GPS no disponible");
          setPhotoDataUrl(null);
          onClosed(updated);
          onClose();
          return;
        } catch (err) {
          if (err instanceof ApiError && err.status >= 500) throw err;
          // Red caída a mitad: encolar
          if (!navigator.onLine || (err instanceof TypeError)) {
            await enqueueCloseVisit(visit.id, payload);
          } else {
            throw err;
          }
        }
      }

      setQty({});
      setNotes("");
      setMode("sin_venta");
      setSkipGps(false);
      setSkipReason("Sin señal / GPS no disponible");
      setPhotoDataUrl(null);
      onClosed(finished);
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo cerrar la visita");
    } finally {
      setSubmitting(false);
    }
  }

  const clientName = visit.client?.name ?? `Cliente #${visit.client_id}`;

  return (
    <div className="screen-form" role="dialog" aria-modal="true" aria-labelledby="close-visit-title">
      <header className="page-header">
        <div>
          <p className="eyebrow">Cerrar visita</p>
          <h1 id="close-visit-title">{clientName}</h1>
          <p className="muted">Venta opcional · GPS / foto de evidencia</p>
        </div>
        <Button variant="ghost" type="button" onClick={onClose}>
          Volver
        </Button>
      </header>

      <form className="card form-stack" onSubmit={onSubmit}>
        <div className="field">
          <span className="field-label">Resultado</span>
          <div className="id-type-toggle" role="group">
            <button
              type="button"
              className={mode === "sin_venta" ? "chip active" : "chip"}
              onClick={() => setMode("sin_venta")}
            >
              Sin venta
            </button>
            <button
              type="button"
              className={mode === "con_venta" ? "chip active" : "chip"}
              onClick={() => setMode("con_venta")}
            >
              Con venta
            </button>
          </div>
        </div>

        {mode === "con_venta" ? (
          <>
            <div className="field">
              <span className="field-label">Moneda</span>
              <div className="id-type-toggle" role="group">
                <button
                  type="button"
                  className={currency === "USD" ? "chip active" : "chip"}
                  onClick={() => setCurrency("USD")}
                >
                  USD
                </button>
                <button
                  type="button"
                  className={currency === "VES" ? "chip active" : "chip"}
                  onClick={() => setCurrency("VES")}
                >
                  Bs (VES)
                </button>
              </div>
            </div>

            {loadingProducts ? <p className="muted">Cargando productos…</p> : null}

            <ul className="product-pick-list">
              {products.map((product) => {
                const q = qty[product.id] ?? 0;
                return (
                  <li key={product.id} className="product-pick-row">
                    <div>
                      <strong>{product.name}</strong>
                      <p className="muted small">
                        {product.sku} · ${Number(product.price_usd).toFixed(2)} / {product.unit} · stock{" "}
                        {product.stock}
                      </p>
                    </div>
                    <div className="qty-controls">
                      <button
                        type="button"
                        className="qty-btn"
                        onClick={() => setProductQty(product.id, q - 1, product.stock)}
                        disabled={q <= 0}
                      >
                        −
                      </button>
                      <span className="qty-value">{q}</span>
                      <button
                        type="button"
                        className="qty-btn"
                        onClick={() => setProductQty(product.id, q + 1, product.stock)}
                        disabled={q >= product.stock}
                      >
                        +
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>

            <p className="sale-total">
              Total estimado: <strong>${total.toFixed(2)} USD</strong>
              {currency === "VES" ? " · liquidar en Bs" : ""}
            </p>
          </>
        ) : null}

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

        <Button type="submit" variant="accent" block disabled={submitting || photoBusy}>
          {submitting ? "Cerrando…" : photoBusy ? "Procesando foto…" : "Confirmar cierre"}
        </Button>
      </form>
    </div>
  );
}
