import { Plus, Trash2 } from "lucide-react";
import { useMemo } from "react";
import { formatQuoteAmount, IVA_RATE, quoteMoney, roundMoney } from "../lib/quoteMoney";
import type { CurrencyCode, Product } from "../lib/types";
import { SearchPickField } from "./SearchPickField";

export type QuoteLine = {
  key: string;
  productId: number | null;
  quantity: number;
};

type Props = {
  products: Product[];
  lines: QuoteLine[];
  onChange: (lines: QuoteLine[]) => void;
  disabled?: boolean;
  applyIva: boolean;
  onApplyIvaChange: (value: boolean) => void;
  currency: CurrencyCode;
  fxRate?: number | null;
};

let lineSeq = 0;
export function newQuoteLine(partial?: Partial<QuoteLine>): QuoteLine {
  lineSeq += 1;
  return {
    key: `ql-${Date.now()}-${lineSeq}`,
    productId: null,
    quantity: 1,
    ...partial,
  };
}

/** Cotizador: código, cant, precio unit., subtotal — en la moneda elegida. */
export function SaleQuoter({
  products,
  lines,
  onChange,
  disabled,
  applyIva,
  onApplyIvaChange,
  currency,
  fxRate,
}: Props) {
  const byId = useMemo(() => {
    const map = new Map<number, Product>();
    for (const p of products) map.set(p.id, p);
    return map;
  }, [products]);

  const selectedIds = useMemo(() => {
    const set = new Set<number>();
    for (const line of lines) {
      if (line.productId != null) set.add(line.productId);
    }
    return set;
  }, [lines]);

  const fx = fxRate != null && fxRate > 0 ? fxRate : null;
  const subtotal = quoteLinesTotal(lines, products);
  const money = quoteMoney(subtotal, applyIva);

  function updateLine(key: string, patch: Partial<QuoteLine>) {
    onChange(lines.map((line) => (line.key === key ? { ...line, ...patch } : line)));
  }

  function removeLine(key: string) {
    const next = lines.filter((line) => line.key !== key);
    onChange(next.length ? next : [newQuoteLine()]);
  }

  function addLine() {
    onChange([...lines, newQuoteLine()]);
  }

  function optionsFor(line: QuoteLine): Product[] {
    return products.filter((p) => {
      if (p.stock <= 0) return false;
      if (p.id !== line.productId && selectedIds.has(p.id)) return false;
      return true;
    });
  }

  function amount(usd: number): string {
    return formatQuoteAmount(usd, currency, fx);
  }

  return (
    <div className="sale-quoter">
      <div className="sale-quoter-head">
        <span className="field-label">Productos</span>
        <span className="muted small">
          {lines.filter((l) => l.productId != null).length} línea(s)
        </span>
      </div>

      <div className="sale-quoter-table">
        <div className="sale-quoter-cols" aria-hidden>
          <span>Código</span>
          <span>Cant.</span>
          <span>Precio unit.</span>
          <span>Subtotal</span>
        </div>

        <ul className="sale-quoter-body">
          {lines.map((line) => {
            const product = line.productId != null ? byId.get(line.productId) : undefined;
            const maxStock = product?.stock ?? 0;
            const opts = optionsFor(line);
            const unitUsd = product ? Number(product.price_usd) : 0;
            const lineUsd = product ? roundMoney(line.quantity * unitUsd) : 0;

            return (
              <li key={line.key} className="sale-quoter-row">
                <div className="sale-quoter-product">
                  <SearchPickField
                    id={`ql-prod-${line.key}`}
                    aria-label="Producto"
                    placeholder="Elegir producto…"
                    valueId={line.productId}
                    disabled={disabled}
                    emptyLabel="Sin producto con stock"
                    options={(product && !opts.some((p) => p.id === product.id)
                      ? [product, ...opts]
                      : opts
                    ).map((p) => ({
                      id: p.id,
                      title: p.name,
                      subtitle: [p.presentation, p.sku, `stock ${p.stock}`].filter(Boolean).join(" · "),
                      imageUrl: p.image_url,
                    }))}
                    onChange={(id) => {
                      const next = id != null ? byId.get(id) : undefined;
                      updateLine(line.key, {
                        productId: id,
                        quantity: next
                          ? Math.min(Math.max(1, line.quantity), next.stock)
                          : 1,
                      });
                    }}
                  />
                  <button
                    type="button"
                    className="sale-quoter-remove"
                    disabled={disabled}
                    aria-label="Quitar línea"
                    onClick={() => removeLine(line.key)}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>

                <div className="sale-quoter-qty">
                  <span className="sale-quoter-label">Cant.</span>
                  <div className="qty-controls">
                    <button
                      type="button"
                      className="qty-btn"
                      disabled={disabled || !product || line.quantity <= 1}
                      aria-label="Menos"
                      onClick={() =>
                        updateLine(line.key, {
                          quantity: Math.max(1, line.quantity - 1),
                        })
                      }
                    >
                      −
                    </button>
                    <span className="qty-value">{product ? line.quantity : 0}</span>
                    <button
                      type="button"
                      className="qty-btn"
                      disabled={disabled || !product || line.quantity >= maxStock}
                      aria-label="Más"
                      onClick={() =>
                        updateLine(line.key, {
                          quantity: Math.min(maxStock, line.quantity + 1),
                        })
                      }
                    >
                      +
                    </button>
                  </div>
                </div>

                <div className="sale-quoter-meta is-num">
                  <span className="sale-quoter-label">Precio unit.</span>
                  <strong>{product ? amount(unitUsd) : "—"}</strong>
                </div>

                <div className="sale-quoter-meta is-num">
                  <span className="sale-quoter-label">Subtotal</span>
                  <strong>{product ? amount(lineUsd) : "—"}</strong>
                </div>
              </li>
            );
          })}
        </ul>

        <button
          type="button"
          className="sale-quoter-add"
          disabled={
            disabled || products.every((p) => p.stock <= 0 || selectedIds.has(p.id))
          }
          onClick={addLine}
        >
          <Plus size={16} aria-hidden />
          Agregar producto
        </button>

        <div className="sale-quoter-foot">
          <label className="sale-quoter-iva">
            <input
              type="checkbox"
              checked={applyIva}
              disabled={disabled}
              onChange={(e) => onApplyIvaChange(e.target.checked)}
            />
            <span>
              Incluir IVA <strong>{(IVA_RATE * 100).toFixed(0)}%</strong>
            </span>
          </label>
          <div className="sale-quoter-totals" aria-label="Totales">
            <div>
              <span>Subtotal</span>
              <strong>{amount(money.subtotal)}</strong>
            </div>
            <div>
              <span>IVA {(IVA_RATE * 100).toFixed(0)}%</span>
              <strong>{applyIva ? amount(money.iva) : "—"}</strong>
            </div>
            <div className="is-total">
              <span>Total</span>
              <strong>{amount(money.total)}</strong>
            </div>
          </div>
        </div>
      </div>

      <div className="sale-quoter-notes">
        <p className="muted small">
          {applyIva
            ? "Precios de línea sin IVA. El total de la OV incluye el 16%."
            : "Montos mostrados sin IVA."}
        </p>
        {fx != null ? (
          <p className="muted small">Tasa del día: {fx.toFixed(2)} Bs/$</p>
        ) : null}
      </div>
    </div>
  );
}

export function quoteLinesToItems(
  lines: QuoteLine[],
): { product_id: number; quantity: number }[] {
  return lines
    .filter(
      (l): l is QuoteLine & { productId: number } =>
        l.productId != null && l.quantity > 0,
    )
    .map((l) => ({ product_id: l.productId, quantity: l.quantity }));
}

export function quoteLinesTotal(lines: QuoteLine[], products: Product[]): number {
  const byId = new Map(products.map((p) => [p.id, p]));
  return roundMoney(
    lines.reduce((sum, line) => {
      if (line.productId == null) return sum;
      const p = byId.get(line.productId);
      if (!p) return sum;
      return sum + line.quantity * Number(p.price_usd);
    }, 0),
  );
}
