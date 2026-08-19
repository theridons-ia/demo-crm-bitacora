import { SaleRow } from "./SaleRow";
import type { Sale } from "../lib/types";
import {
  formatSaleWhen,
  PAYMENT_METHOD_LABEL,
  SALE_ORIGIN_LABEL,
  saleItemCount,
  saleOrderCode,
  saleUnitCount,
  formatSaleTotal,
  saleCurrencyLabel,
} from "../lib/saleLabels";

type Props = {
  sales: Sale[];
  sellerNameById?: Map<number, string>;
  showSeller?: boolean;
  onRowClick: (sale: Sale) => void;
};

/** Móvil: SaleRow. Desktop: tabla de columnas. */
export function SalesTable({ sales, sellerNameById, showSeller, onRowClick }: Props) {
  return (
    <>
      <ul className="visit-row-list sale-row-list">
        {sales.map((sale) => (
          <SaleRow
            key={sale.id}
            sale={sale}
            sellerName={showSeller ? sellerNameById?.get(sale.seller_id) : null}
            onClick={() => onRowClick(sale)}
          />
        ))}
      </ul>
      <div className="sales-table-card">
      <div className={`sales-table-head ${showSeller ? "with-seller" : ""}`.trim()} aria-hidden>
        <span>Pedido</span>
        <span>Cliente</span>
        {showSeller ? <span>Vendedor</span> : null}
        <span>Fecha</span>
        <span>Origen</span>
        <span>Pago</span>
        <span>Total</span>
      </div>
      <ul className="sales-table-body">
        {sales.map((sale) => {
          const name = sale.client?.name ?? `Cliente #${sale.client_id}`;
          const id = sale.client?.rif ?? (sale.client?.ci ? `CI ${sale.client.ci}` : "");
          const seller = sellerNameById?.get(sale.seller_id);
          const items = saleItemCount(sale);
          const units = saleUnitCount(sale);
          return (
            <li key={sale.id}>
              <button
                type="button"
                className={`sales-row is-clickable ${showSeller ? "with-seller" : ""}`.trim()}
                onClick={() => onRowClick(sale)}
              >
                <div className="sales-col sales-col-ov">
                  <strong>{saleOrderCode(sale)}</strong>
                  <span className="muted small">
                    {items} ítem{items === 1 ? "" : "s"} · {units} ud
                  </span>
                </div>
                <div className="sales-col sales-col-client">
                  <strong className="sales-client-name">{name}</strong>
                  {id ? <span className="muted small">{id}</span> : null}
                </div>
                {showSeller ? (
                  <div className="sales-col sales-col-seller muted">{seller ?? "—"}</div>
                ) : null}
                <div className="sales-col sales-col-date">
                  <span>{formatSaleWhen(sale.created_at)}</span>
                  <span className="muted small">
                    {sale.visit_id ? `Visita #${sale.visit_id}` : "Sin visita"}
                  </span>
                </div>
                <div className="sales-col sales-col-origin">
                  <span className="badge badge-muted">{SALE_ORIGIN_LABEL[sale.origin]}</span>
                </div>
                <div className="sales-col sales-col-pay">
                  {sale.is_credit ? (
                    <span className="badge badge-credit">Crédito</span>
                  ) : (
                    <span className="muted small">
                      {PAYMENT_METHOD_LABEL[sale.payment_method] ?? sale.payment_method}
                    </span>
                  )}
                </div>
                <div className="sales-col sales-col-total">
                  <strong>{formatSaleTotal(sale)}</strong>
                  <span className="muted small">{saleCurrencyLabel(sale.currency)}</span>
                </div>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
    </>
  );
}
