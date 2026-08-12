import { Package, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { TextField } from "../components/TextField";
import { ApiError, fetchProducts } from "../lib/api";
import { getCachedProducts } from "../lib/offlineQueue";
import type { Product } from "../lib/types";

const LOW_STOCK = 40;

type StockState = "disponible" | "bajo" | "agotado";

function stockState(stock: number): StockState {
  if (stock <= 0) return "agotado";
  if (stock < LOW_STOCK) return "bajo";
  return "disponible";
}

function stockPct(stock: number): number {
  const max = Math.max(LOW_STOCK * 2, stock);
  return Math.min(100, Math.round((stock / max) * 100));
}

/** Inventario — refresh visual SF-2.6 (móvil + desktop). */
export function InventoryPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"todos" | StockState>("todos");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = navigator.onLine ? await fetchProducts() : await getCachedProducts();
        if (!cancelled) setProducts(data.length ? data : await getCachedProducts());
      } catch (err) {
        if (cancelled) return;
        const cached = await getCachedProducts();
        setProducts(cached);
        if (!cached.length) {
          setError(err instanceof ApiError ? err.message : "Error al cargar inventario");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const valueStock = useMemo(
    () => products.reduce((acc, p) => acc + Number(p.price_usd) * p.stock, 0),
    [products],
  );
  const toRestock = useMemo(
    () => products.filter((p) => stockState(p.stock) !== "disponible").length,
    [products],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products.filter((p) => {
      const st = stockState(p.stock);
      if (status !== "todos" && st !== status) return false;
      if (!q) return true;
      return `${p.name} ${p.sku}`.toLowerCase().includes(q);
    });
  }, [products, query, status]);

  return (
    <>
      <header className="page-header page-header-stack">
        <div>
          <p className="eyebrow">Operación · bodega</p>
          <h1 className="display-title">Inventario que acompaña la ruta.</h1>
          <p className="muted">Stock visible según tu rol · precios USD</p>
        </div>
      </header>

      <section className="kpi-row" aria-label="Resumen inventario">
        <article className="kpi-card">
          <p className="kpi-value">${valueStock.toFixed(0)}</p>
          <p className="kpi-label">valor en stock</p>
        </article>
        <article className="kpi-card">
          <p className="kpi-value">{products.length}</p>
          <p className="kpi-label">productos</p>
        </article>
        <article className="kpi-card">
          <p className="kpi-value kpi-accent">{toRestock}</p>
          <p className="kpi-label">reponer</p>
        </article>
      </section>

      <section className="card seller-panel">
        <div className="search-row">
          <Search size={18} className="search-icon" aria-hidden />
          <TextField
            id="inv-search"
            label="Buscar producto"
            placeholder="Nombre o SKU…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        <div className="filter-chips" role="tablist" aria-label="Estado de stock">
          {(
            [
              ["todos", "Todos"],
              ["disponible", "Disponible"],
              ["bajo", "Bajo stock"],
              ["agotado", "Agotado"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={status === id ? "chip active" : "chip"}
              onClick={() => setStatus(id)}
            >
              {label}
            </button>
          ))}
        </div>

        {loading ? <p className="muted">Cargando…</p> : null}
        {error ? <p className="form-error">{error}</p> : null}

        <ul className="inv-list">
          {filtered.map((p) => {
            const st = stockState(p.stock);
            return (
              <li key={p.id} className="inv-row">
                <span className="inv-icon" aria-hidden>
                  <Package size={18} />
                </span>
                <div className="inv-body">
                  <div className="inv-top">
                    <strong>{p.name}</strong>
                    <span
                      className={`status-pill ${
                        st === "disponible" ? "status-ok" : st === "bajo" ? "status-warn" : "status-bad"
                      }`}
                    >
                      {st === "disponible" ? "Disponible" : st === "bajo" ? "Bajo stock" : "Agotado"}
                    </span>
                  </div>
                  <p className="muted small">
                    {p.sku} · ${Number(p.price_usd).toFixed(2)} / {p.unit}
                  </p>
                  <div className="inv-bar-wrap" aria-hidden>
                    <span
                      className={`inv-bar inv-bar-${st}`}
                      style={{ width: `${stockPct(p.stock)}%` }}
                    />
                  </div>
                  <p className="muted small">
                    Stock {p.stock}
                    {st !== "agotado" ? ` · mín. ref. ${LOW_STOCK}` : ""}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      </section>
    </>
  );
}
