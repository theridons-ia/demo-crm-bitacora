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
          <>
            <div className="visit-sale-quote-summary" role="status">
              <div>
                <span className="muted small">Total</span>
                <strong>
                  ${Number(sale.total_amount).toFixed(2)} {sale.currency}
                </strong>
              </div>
              <div>
                <span className="muted small">IVA</span>
                <strong>{sale.apply_iva || quoteData?.applyIva ? "16%" : "Sin IVA"}</strong>
              </div>
              <div>
                <span className="muted small">Ítems</span>
                <strong>
                  {items} · {units} ud
                </strong>
              </div>
              <div>
                <span className="muted small">Pago</span>
                <strong>
                  {sale.is_credit
                    ? "Crédito"
                    : PAYMENT_METHOD_LABEL[sale.payment_method] ?? sale.payment_method}
                </strong>
              </div>
            </div>

            <dl className="visit-detail-grid">
              <div className="visit-detail-row">
                <dt>Cliente</dt>
                <dd>
                  {name}
                  {clientId ? ` · ${clientId}` : ""}
                </dd>
              </div>
              {sellerName ? (
                <div className="visit-detail-row">
                  <dt>Vendedor</dt>
                  <dd>{sellerName}</dd>
                </div>
              ) : null}
              <div className="visit-detail-row">
                <dt>Origen</dt>
                <dd>
                  {SALE_ORIGIN_LABEL[sale.origin]}
                  {sale.visit_id ? ` · visita #${sale.visit_id}` : " · sin visita"}
                </dd>
              </div>
              {sale.payment_reference ? (
                <div className="visit-detail-row">
                  <dt>Referencia</dt>
                  <dd>{sale.payment_reference}</dd>
                </div>
              ) : null}
              {sale.notes ? (
                <div className="visit-detail-row">
                  <dt>Nota</dt>
                  <dd>{sale.notes}</dd>
                </div>
              ) : null}
            </dl>

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
                            {product?.sku ?? `ID ${line.product_id}`}
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
          </>
        ) : null}

        {tab === "documento" && quoteData ? (
          <QuoteDocument data={quoteData} asImage />
        ) : null}
      </div>
    </Modal>
  );
}
