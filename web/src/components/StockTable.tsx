import { Package } from "lucide-react";
import type { Product } from "../lib/types";

export const LOW_STOCK = 40;

export type StockState = "disponible" | "bajo" | "agotado";

export function stockState(stock: number): StockState {
  if (stock <= 0) return "agotado";
  if (stock < LOW_STOCK) return "bajo";
  return "disponible";
}

export function stockPct(stock: number): number {
  const max = Math.max(LOW_STOCK * 2, stock);
  return Math.min(100, Math.round((stock / max) * 100));
}

export function productCategory(product: Product): string {
  const key = `${product.sku} ${product.name}`.toLowerCase();
  if (/agua|jugo|cola|malta|leche|beb|refresco/.test(key)) return "Bebidas";
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
  const st = stockState(product.stock);
  const value = Number(product.price_usd) * product.stock;
  const inner = (
    <>
      <div className="stock-col stock-col-product">
        <span className="stock-product-icon" aria-hidden>
          <Package size={16} />
        </span>
        <span className="stock-product-copy">
          <strong className="stock-product-name">{product.name}</strong>
          <span className="stock-product-sku">{product.sku}</span>
        </span>
      </div>
      <div className="stock-col stock-col-cat muted">{productCategory(product)}</div>
      <div className="stock-col stock-col-stock">
        <strong className="stock-qty">
          {product.stock} {product.unit}
        </strong>
        <div className="inv-bar-wrap" aria-hidden>
          <span className={`inv-bar inv-bar-${st}`} style={{ width: `${stockPct(product.stock)}%` }} />
        </div>
        <span className="stock-min muted small">mínimo {LOW_STOCK}</span>
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
