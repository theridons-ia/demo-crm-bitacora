import { useEffect, useMemo, useState } from "react";
import { AsideStats } from "../components/AsideStats";
import { ListSearch } from "../components/ListSearch";
import { StockTable, stockState, type StockState } from "../components/StockTable";
import { WorkspacePage } from "../layout/WorkspacePage";
import { ApiError, fetchProducts } from "../lib/api";
import { getCachedProducts } from "../lib/offlineQueue";
import type { Product } from "../lib/types";

/** Inventario vendedor — tabla de existencias (sin ajuste rápido). */
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
    <WorkspacePage
      eyebrow="Campo"
      title="Inventario"
      blurb="Consulta el stock disponible para tu ruta."
      asideExtra={
        <AsideStats
          title="Tu stock"
          eyebrow="Inventario"
          items={[
            { label: "Valor", value: `$${valueStock.toFixed(0)}` },
            { label: "A reponer", value: toRestock },
          ]}
        />
      }
    >
      <header className="page-header page-header-stack">
        <div>
          <p className="eyebrow">Operación · bodega</p>
          <h1 className="display-title">Existencias actuales</h1>
          <p className="muted">
            {filtered.length} productos visibles · ${valueStock.toFixed(0)} en stock
          </p>
        </div>
      </header>

      <div className="list-page-tools">
        <ListSearch
          id="inv-search"
          value={query}
          onChange={setQuery}
          placeholder="Nombre o SKU…"
        />
        <div className="filter-chips chips-row" role="tablist" aria-label="Estado de stock">
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
      </div>

      {loading ? <p className="muted list-loading">Cargando…</p> : null}
      {error ? <p className="form-error">{error}</p> : null}

      {!loading && filtered.length ? <StockTable products={filtered} /> : null}

      {!loading && filtered.length === 0 ? (
        <p className="muted">Sin productos con este filtro.</p>
      ) : null}
    </WorkspacePage>
  );
}
