import { Search, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { unitPriceForQuote } from "../lib/productPrices";
import { formatQuoteAmount, IVA_RATE, quoteMoney, roundMoney } from "../lib/quoteMoney";
import type { CurrencyCode, Product } from "../lib/types";
import { ProductThumb } from "./ProductThumb";

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
  onCurrencyChange?: (currency: CurrencyCode) => void;
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

function fold(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .trim();
}

function matchesQuery(product: Product, query: string): boolean {
  if (!query) return true;
  const hay = fold(
    [product.name, product.sku, product.presentation].filter(Boolean).join(" "),
  );
  return query.split(/\s+/).every((part) => hay.includes(part));
}

/** Carrito de OV: buscar, fichas de producto, total. */
export function SaleQuoter({
  products,
  lines,
  onChange,
  disabled,
  applyIva,
  onApplyIvaChange,
  currency,
  onCurrencyChange,
  fxRate,
}: Props) {
  const [query, setQuery] = useState("");
  const byId = useMemo(() => {
    const map = new Map<number, Product>();
    for (const p of products) map.set(p.id, p);
    return map;
  }, [products]);

  const filled = useMemo(
    () => lines.filter((line) => line.productId != null),
    [lines],
  );

  const qtyByProduct = useMemo(() => {
    const map = new Map<number, number>();
    for (const line of filled) {
      if (line.productId == null) continue;
      map.set(line.productId, (map.get(line.productId) ?? 0) + line.quantity);
    }
    return map;
  }, [filled]);

  const inStock = useMemo(() => products.filter((p) => p.stock > 0), [products]);

  const matches = useMemo(() => {
    const q = fold(query);
    if (!q) return [];
    return inStock.filter((p) => matchesQuery(p, q)).slice(0, 40);
  }, [inStock, query]);

  const searching = fold(query).length > 0;
  const fx = fxRate != null && fxRate > 0 ? fxRate : null;
  const subtotal = quoteLinesTotal(lines, products, currency);
  const money = quoteMoney(subtotal, applyIva);
  const itemCount = filled.reduce((sum, line) => sum + line.quantity, 0);

  function updateLine(key: string, patch: Partial<QuoteLine>) {
    onChange(lines.map((line) => (line.key === key ? { ...line, ...patch } : line)));
  }

  function removeLine(key: string) {
    onChange(lines.filter((line) => line.key !== key));
  }

  function addProduct(id: number) {
    const product = byId.get(id);
    if (!product || disabled) return;
    const unit = unitPriceForQuote(product, currency);
    if (unit == null) return;
    const existing = lines.find((line) => line.productId === id);
    if (existing) {
      updateLine(existing.key, {
        quantity: Math.min(product.stock, existing.quantity + 1),
      });
      return;
    }
    onChange([...filled, newQuoteLine({ productId: id, quantity: 1 })]);
  }

  function amount(n: number): string {
    return formatQuoteAmount(n, currency);
  }

  return (
    <div className="sale-cart">
      <div className="sale-cart-toolbar">
        {onCurrencyChange ? (
          <div className="choice-group" role="group" aria-label="Moneda">
            <button
              type="button"
              className={currency === "USD" ? "chip active" : "chip"}
              disabled={disabled}
              onClick={() => onCurrencyChange("USD")}
            >
              USD
            </button>
            <button
              type="button"
              className={currency === "VES" ? "chip active" : "chip"}
              disabled={disabled}
              onClick={() => onCurrencyChange("VES")}
            >
              Bs
            </button>
          </div>
        ) : null}
        <label className="sale-cart-iva">
          <input
            type="checkbox"
            checked={applyIva}
            disabled={disabled}
            onChange={(e) => onApplyIvaChange(e.target.checked)}
          />
          <span>IVA {(IVA_RATE * 100).toFixed(0)}%</span>
        </label>
      </div>

      <div className="sale-cart-metrics">
        <div className="sale-cart-metric">
          <span>Productos</span>
          <strong>{itemCount}</strong>
        </div>
        <div className="sale-cart-metric">
          <span>Total</span>
          <strong>{amount(money.total)}</strong>
        </div>
      </div>

      <label className="sale-cart-search">
        <Search size={18} aria-hidden />
        <input
          className="input"
          type="search"
          inputMode="search"
          enterKeyHint="search"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          placeholder="Buscar…"
          aria-label="Buscar producto"
          disabled={disabled}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </label>

      {searching ? (
        matches.length ? (
          <ul className="sale-cart-list">
            {matches.map((product) => {
              const unit = unitPriceForQuote(product, currency);
              const inCart = qtyByProduct.get(product.id) ?? 0;
              const canAdd = unit != null && inCart < product.stock && !disabled;
              return (
                <li key={product.id}>
                  <button
                    type="button"
                    className="sale-cart-pick"
                    disabled={!canAdd}
                    onClick={() => addProduct(product.id)}
                  >
                    <div className="sale-cart-copy">
                      <strong>{product.name}</strong>
                      <span className="muted small">
                        {product.stock} disponibles
                        {product.presentation ? ` · ${product.presentation}` : ""}
                      </span>
                      <span className="sale-cart-price">
                        {unit != null ? amount(unit) : "Sin precio"}
                      </span>
                      {inCart > 0 ? (
                        <span className="sale-cart-badge">En pedido · {inCart}</span>
                      ) : null}
                    </div>
                    <ProductThumb src={product.image_url} alt="" size="lg" />
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="sale-cart-empty muted">Sin coincidencias.</p>
        )
      ) : null}

      {!searching && filled.length === 0 ? (
        <p className="sale-cart-empty muted">Busca un producto para armar el pedido.</p>
      ) : null}

      {filled.length ? (
        <>
          <p className="sale-cart-heading">Pedido</p>
          <ul className="sale-cart-list">
            {filled.map((line) => {
              const product = line.productId != null ? byId.get(line.productId) : undefined;
              if (!product) return null;
              const maxStock = product.stock;
              const unit = unitPriceForQuote(product, currency);
              const lineTotal = unit != null ? roundMoney(line.quantity * unit) : 0;
              return (
                <li key={line.key} className="sale-cart-row">
                  <div className="sale-cart-copy">
                    <strong>{product.name}</strong>
                    <span className="muted small">
                      {product.stock} disponibles
                      {[product.sku, product.presentation].filter(Boolean).length
                        ? ` · ${[product.sku, product.presentation].filter(Boolean).join(" · ")}`
                        : ""}
                    </span>
                    <span className="sale-cart-price">
                      {unit != null ? `${amount(unit)} c/u` : "Sin precio"}
                    </span>
                  </div>
                  <ProductThumb src={product.image_url} alt="" size="lg" />
                  <div className="sale-cart-side">
                    <div className="qty-controls">
                      <button
                        type="button"
                        className="qty-btn"
                        disabled={disabled || line.quantity <= 1}
                        aria-label="Menos"
                        onClick={() =>
                          updateLine(line.key, { quantity: Math.max(1, line.quantity - 1) })
                        }
                      >
                        −
                      </button>
                      <span className="qty-value">{line.quantity}</span>
                      <button
                        type="button"
                        className="qty-btn"
                        disabled={disabled || line.quantity >= maxStock}
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
                    <strong className="sale-cart-line">
                      {unit != null ? amount(lineTotal) : "—"}
                    </strong>
                    <button
                      type="button"
                      className="sale-quoter-remove"
                      disabled={disabled}
                      aria-label="Quitar"
                      onClick={() => removeLine(line.key)}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      ) : null}

      {itemCount > 0 && (applyIva || fx != null) ? (
        <div className="sale-cart-iva-note muted small" aria-live="polite">
          {applyIva ? (
            <span className="sale-cart-iva-summary">
              <span>
                Subtotal <strong>{amount(money.subtotal)}</strong>
              </span>
              <span>
                IVA <strong>{amount(money.iva)}</strong>
              </span>
              <span className="sale-cart-iva-total">
                Total <strong>{amount(money.total)}</strong>
              </span>
            </span>
          ) : null}
          {fx != null ? (
            <span className="sale-cart-rate">
              Tasa <strong>{fx.toFixed(2)} Bs/$</strong>
            </span>
          ) : null}
        </div>
      ) : null}
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

export function quoteLinesTotal(
  lines: QuoteLine[],
  products: Product[],
  currency: CurrencyCode = "USD",
): number {
  const byId = new Map(products.map((p) => [p.id, p]));
  return roundMoney(
    lines.reduce((sum, line) => {
      if (line.productId == null) return sum;
      const p = byId.get(line.productId);
      if (!p) return sum;
      const unit = unitPriceForQuote(p, currency);
      if (unit == null) return sum;
      return sum + line.quantity * unit;
    }, 0),
  );
}

export function quoteMissingVesPrice(lines: QuoteLine[], products: Product[]): string | null {
  const byId = new Map(products.map((p) => [p.id, p]));
  for (const line of lines) {
    if (line.productId == null) continue;
    const p = byId.get(line.productId);
    if (!p) continue;
    if (unitPriceForQuote(p, "VES") == null) {
      return `${p.name} no tiene Precio 3 (Bs)`;
    }
  }
  return null;
}
