import { ProductThumb } from "./ProductThumb";
import { productExpiry } from "../lib/productFields";
import type { Product } from "../lib/types";

export const LOW_STOCK = 40;

export type StockState = "disponible" | "bajo" | "agotado";

export function effectiveMinStock(min?: number | null): number {
  return min != null && min > 0 ? min : LOW_STOCK;
}

export function stockState(stock: number, min: number = LOW_STOCK): StockState {
  const floor = effectiveMinStock(min);
  if (stock <= 0) return "agotado";
  if (stock < floor) return "bajo";
  return "disponible";
}

export function stockPct(stock: number, min: number = LOW_STOCK): number {
  const floor = effectiveMinStock(min);
  const max = Math.max(floor * 2, stock);
  return Math.min(100, Math.round((stock / max) * 100));
}

export function productCategory(product: Product): string {
  if (product.category?.trim()) return product.category.trim();
  const key = `${product.sku} ${product.name}`.toLowerCase();
  if (/agua|jugo|cola|malta|leche|beb|refresco|glup|minalba|arizona|greenspot|iced tea/.test(key)) {
    return "Bebidas";
  }
  if (/harina|arroz|aceite|pan/.test(key)) return "Abarrotes";
  if (/snack|galleta|chips/.test(key)) return "Snacks";
  if (/dulce|chocolate|caramelo/.test(key)) return "Dulces";
  return "General";
}

const STATE_LABEL: Record<StockState, string> = {
  disponible: "Disponible",
  bajo: "Bajo stock",
  agotado: "Agotado",
};

type RowProps = {
  product: Product;
  onClick?: () => void;
};

function StockTableRow({ product, onClick }: RowProps) {
  const min = effectiveMinStock(product.min_stock);
  const st = stockState(product.stock, min);
  const value = Number(product.price_usd) * product.stock;
  const expiry = productExpiry(product.expires_on);
  const inner = (
    <>
      <div className="stock-col stock-col-product">
        <ProductThumb src={product.image_url} alt="" size="md" />
        <span className="stock-product-copy">
          <strong className="stock-product-name">{product.name}</strong>
          <span className="stock-product-sku">
            {product.sku}
            {product.presentation ? ` · ${product.presentation}` : ""}
          </span>
          {expiry && expiry.tone !== "ok" ? (
            <span className={`stock-expiry is-${expiry.tone}`}>{expiry.text}</span>
          ) : null}
        </span>
      </div>
      <div className="stock-col stock-col-cat muted">{productCategory(product)}</div>
      <div className="stock-col stock-col-stock">
        <strong className="stock-qty">
          {product.stock} {product.unit}
        </strong>
        <div className="inv-bar-wrap" aria-hidden>
          <span className={`inv-bar inv-bar-${st}`} style={{ width: `${stockPct(product.stock, min)}%` }} />
        </div>
        <span className="stock-min muted small">mínimo {min}</span>
      </div>
      <div className="stock-col stock-col-state">
        <span
          className={`status-pill ${
            st === "disponible" ? "status-ok" : st === "bajo" ? "status-warn" : "status-bad"
          }`}
        >
          {STATE_LABEL[st]}
        </span>
      </div>
      <div className="stock-col stock-col-value">
        <strong>${value.toFixed(0)}</strong>
      </div>
    </>
  );

  if (onClick) {
    return (
      <button type="button" className="stock-row is-clickable" onClick={onClick}>
        {inner}
      </button>
    );
  }
  return <div className="stock-row">{inner}</div>;
}

type TableProps = {
  products: Product[];
  onRowClick?: (product: Product) => void;
};

/** Tabla de existencias estilo demo (sin columna de ajuste rápido). */
export function StockTable({ products, onRowClick }: TableProps) {
  return (
    <div className="stock-table-card">
      <div className="stock-table-head" aria-hidden>
        <span>Producto</span>
        <span>Categoría</span>
        <span>Stock / mínimo</span>
        <span>Estado</span>
        <span>Valor</span>
      </div>
      <ul className="stock-table-body">
        {products.map((p) => (
          <li key={p.id}>
            <StockTableRow product={p} onClick={onRowClick ? () => onRowClick(p) : undefined} />
          </li>
        ))}
      </ul>
    </div>
  );
}
