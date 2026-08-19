import { ChevronRight } from "lucide-react";
import { formatSaleTotal, formatSaleWhen, saleCurrencyLabel, saleOrderCode } from "../lib/saleLabels";
import type { Sale } from "../lib/types";

type Props = {
  sale: Sale;
  onClick: () => void;
  /** Equipo: quién cerró la OV. */
  sellerName?: string | null;
};

function payLabel(sale: Sale): string {
  return sale.is_credit ? "Crédito" : "Contado";
}

function metaLabel(sale: Sale, sellerName?: string | null): string {
  const parts = [formatSaleWhen(sale.created_at), saleOrderCode(sale), payLabel(sale)];
  if (sellerName) parts.push(sellerName);
  return parts.join(" · ");
}

/**
 * Fila de pedido (móvil): punto · PDV · fecha/código/pago · monto · chevron.
 * Toda la fila abre la ficha. Sin carrito ni ítems/ud.
 */
export function SaleRow({ sale, onClick, sellerName }: Props) {
  const name = sale.client?.name ?? `Cliente #${sale.client_id}`;
  const credit = Boolean(sale.is_credit);

  return (
    <li>
      <button
        type="button"
        className={`visit-row sale-row ${credit ? "is-credit" : "is-cash"}`}
        onClick={onClick}
      >
        <span className="visit-row-status" aria-hidden>
          <span className={`visit-row-dot ${credit ? "is-credit" : "is-cash"}`} />
        </span>
        <span className="visit-row-copy">
          <span className="visit-row-name">{name}</span>
          <span className="visit-row-meta">{metaLabel(sale, sellerName)}</span>
        </span>
        <span className="sale-row-amt">
          <strong>{formatSaleTotal(sale)}</strong>
          <span>{saleCurrencyLabel(sale.currency)}</span>
        </span>
        <ChevronRight size={18} className="visit-row-chevron" aria-hidden />
      </button>
    </li>
  );
}
