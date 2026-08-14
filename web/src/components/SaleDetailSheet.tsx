import { useEffect, useMemo, useState } from "react";
import { Button } from "./Button";
import { Modal } from "./Modal";
import { QuoteDocument } from "./QuoteDocument";
import { fetchProducts } from "../lib/api";
import {
  formatSaleWhen,
  PAYMENT_METHOD_LABEL,
  SALE_ORIGIN_LABEL,
  saleItemCount,
  saleOrderCode,
  saleUnitCount,
} from "../lib/saleLabels";
import {
  buildQuoteDataFromSale,
  parseQuoteSnapshot,
  snapshotToQuoteDocumentData,
} from "../lib/quoteSnapshot";
import { getCachedProducts } from "../lib/offlineQueue";
import type { Product, Sale } from "../lib/types";

type Props = {
  sale: Sale | null;
  open: boolean;
  onClose: () => void;
  sellerName?: string | null;
  /** Abrir directo en el documento guardado. */
  initialTab?: "resumen" | "documento";
};

/** Ficha de OV: resumen + cotización/OV guardada (descargable). */
export function SaleDetailSheet({
  sale,
  open,
  onClose,
  sellerName,
  initialTab = "resumen",
}: Props) {
  const [products, setProducts] = useState<Product[]>([]);
  const [tab, setTab] = useState<"resumen" | "documento">(initialTab);

  useEffect(() => {
    if (!open) return;
    setTab(initialTab);
  }, [open, sale?.id, initialTab]);

  useEffect(() => {
    if (!open || !sale) return;
    let cancelled = false;
    (async () => {
      try {
        const catalog = navigator.onLine ? await fetchProducts() : await getCachedProducts();
        if (!cancelled) setProducts(catalog);
      } catch {
        const cached = await getCachedProducts();
        if (!cancelled) setProducts(cached);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, sale?.id]);

  const byId = useMemo(() => {
    const map = new Map<number, Product>();
    for (const p of products) map.set(p.id, p);
    return map;
  }, [products]);

  const quoteData = useMemo(() => {
    if (!sale) return null;
    const snap = parseQuoteSnapshot(sale.quote_snapshot);
    if (snap) {
      const data = snapshotToQuoteDocumentData(snap);
      data.code = saleOrderCode(sale);
      return data;
    }
    return buildQuoteDataFromSale(sale, products, sellerName ?? "Vendedor");
  }, [sale, products, sellerName]);

  if (!sale) return null;

  const name = sale.client?.name ?? `Cliente #${sale.client_id}`;
  const clientId =
    sale.client?.rif ?? (sale.client?.ci ? `CI ${sale.client.ci}` : null);
  const items = saleItemCount(sale);
  const units = saleUnitCount(sale);
  const payLabel = sale.is_credit
    ? "Crédito"
    : PAYMENT_METHOD_LABEL[sale.payment_method] ?? sale.payment_method;
  const avatar = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase() || "?";

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="wide"
      eyebrow="Orden de venta"
      title={saleOrderCode(sale)}
      blurb={`${formatSaleWhen(sale.created_at)} · ${SALE_ORIGIN_LABEL[sale.origin]}`}
      footer={
        <div className="side-sheet-actions">
          <Button type="button" variant="accent" onClick={onClose}>
            Cerrar
          </Button>
        </div>
      }
    >
      <div className="sale-detail sheet-form-stack">
        <div className="choice-group" role="tablist" aria-label="Vista de la OV">
          <button
            type="button"
            className={tab === "resumen" ? "chip active" : "chip"}
            onClick={() => setTab("resumen")}
          >
            Resumen
          </button>
          <button
            type="button"
            className={tab === "documento" ? "chip active" : "chip"}
            onClick={() => setTab("documento")}
          >
            Cotización / documento
          </button>
        </div>

        {tab === "resumen" ? (
          <div className="profile-ficha">
            <div className="visit-ficha-id">
              <span className="visit-ficha-avatar" aria-hidden>
                {avatar}
              </span>
              <div className="visit-ficha-id-copy">
                <p className="eyebrow">Cliente</p>
                <strong>{name}</strong>
                <span className="muted small">
                  {clientId ?? "Sin RIF/CI"}
                  {sellerName ? ` · ${sellerName}` : ""}
                </span>
              </div>
              <span className="badge badge-completada">{payLabel}</span>
            </div>

            <div className="visit-sale-confirmed" role="status">
              <div className="visit-sale-confirmed-copy">
                <p className="eyebrow">Resumen</p>
                <strong>
                  ${Number(sale.total_amount).toFixed(2)} {sale.currency}
                </strong>
                <div className="visit-sale-metrics sale-resumen-metrics">
                  <div>
                    <span className="muted small">IVA</span>
                    <b>{sale.apply_iva || quoteData?.applyIva ? "16%" : "Sin IVA"}</b>
                  </div>
                  <div>
                    <span className="muted small">Ítems</span>
                    <b>
                      {items} · {units} ud
                    </b>
                  </div>
                  <div>
                    <span className="muted small">Pago</span>
                    <b>{payLabel}</b>
                  </div>
                  <div>
                    <span className="muted small">Origen</span>
                    <b>{SALE_ORIGIN_LABEL[sale.origin]}</b>
                  </div>
                </div>
              </div>
            </div>

            <div className="visit-ficha-facts">
              <article className="visit-ficha-fact">
                <span className="muted small">Fecha</span>
                <strong>{formatSaleWhen(sale.created_at)}</strong>
              </article>
              {sale.visit_id ? (
                <article className="visit-ficha-fact">
                  <span className="muted small">Visita</span>
                  <strong>#{sale.visit_id}</strong>
                </article>
              ) : (
                <article className="visit-ficha-fact">
                  <span className="muted small">Visita</span>
                  <strong>Sin visita</strong>
                </article>
              )}
              {sale.payment_reference ? (
                <article className="visit-ficha-fact visit-ficha-fact-wide">
                  <span className="muted small">Referencia</span>
                  <strong>{sale.payment_reference}</strong>
                </article>
              ) : null}
              {sale.notes ? (
                <article className="visit-ficha-fact visit-ficha-fact-wide">
                  <span className="muted small">Nota</span>
                  <strong>{sale.notes}</strong>
                </article>
              ) : null}
            </div>

            <div className="field">
              <span className="field-label">Productos</span>
              <div className="sale-detail-lines">
                <div className="sale-detail-lines-head" aria-hidden>
                  <span>Producto</span>
                  <span>Cant.</span>
                  <span>P. unit.</span>
                  <span>Subtotal</span>
                </div>
                <ul>
                  {(sale.items ?? []).map((line) => {
                    const product = byId.get(line.product_id);
                    return (
                      <li key={`${sale.id}-${line.product_id}`}>
                        <span>
                          <strong>{product?.name ?? `Producto #${line.product_id}`}</strong>
                          <span className="muted small">
                            {line.quantity} × ${Number(line.unit_price).toFixed(2)}
                            {product?.sku ? ` · ${product.sku}` : ""}
                          </span>
                        </span>
                        <span>{line.quantity}</span>
                        <span>${Number(line.unit_price).toFixed(2)}</span>
                        <span>
                          <strong>${Number(line.line_total).toFixed(2)}</strong>
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>
          </div>
        ) : null}

        {tab === "documento" && quoteData ? (
          <QuoteDocument data={quoteData} asImage />
        ) : null}
      </div>
    </Modal>
  );
}
