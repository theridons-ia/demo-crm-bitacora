import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Button } from "./Button";
import { TextField } from "./TextField";
import { ApiError, closeVisit, fetchProducts, type VisitCloseInput } from "../lib/api";
import { getCurrentPosition } from "../lib/gps";
import type { CurrencyCode, Product, Visit } from "../lib/types";

type Props = {
  visit: Visit;
  open: boolean;
  onClose: () => void;
  onClosed: (visit: Visit) => void;
};

type QtyMap = Record<number, number>;

export function CloseVisitSheet({ visit, open, onClose, onClosed }: Props) {
  const [products, setProducts] = useState<Product[]>([]);
  const [mode, setMode] = useState<"sin_venta" | "con_venta">("sin_venta");
  const [qty, setQty] = useState<QtyMap>({});
  const [currency, setCurrency] = useState<CurrencyCode>("USD");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [loadingProducts, setLoadingProducts] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoadingProducts(true);
    fetchProducts()
      .then((data) => {
        if (!cancelled) setProducts(data);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof ApiError ? err.message : "No se pudo cargar inventario");
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingProducts(false);
      });
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

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    if (mode === "con_venta" && lines.length === 0) {
      setError("Agrega al menos un producto o cierra sin venta");
      return;
    }

    setSubmitting(true);
    try {
      const geo = await getCurrentPosition();
      const gpsFields =
        geo.ok
          ? {
              latitude: geo.fix.latitude,
              longitude: geo.fix.longitude,
              gps_accuracy_m: geo.fix.accuracy_m,
              gps_offline: false,
              gps_captured_at: geo.fix.captured_at,
            }
          : { gps_offline: true };

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
        };
      }

      const updated = await closeVisit(visit.id, payload);
      setQty({});
      setNotes("");
      setMode("sin_venta");
      onClosed(updated);
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
          <p className="muted">SF-1.7 — con o sin venta · GPS al confirmar</p>
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
              <p className="muted small" style={{ margin: "0.35rem 0 0" }}>
                Precios del catálogo están en USD; VES marca la moneda de liquidación (FX fino después).
              </p>
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

        <TextField
          id="close-notes"
          label="Nota"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />

        {error ? (
          <p className="form-error" role="alert">
            {error}
          </p>
        ) : null}

        <Button type="submit" variant="accent" block disabled={submitting}>
          {submitting ? "Cerrando…" : mode === "con_venta" ? "Confirmar venta + GPS" : "Cerrar sin venta + GPS"}
        </Button>
      </form>
    </div>
  );
}
