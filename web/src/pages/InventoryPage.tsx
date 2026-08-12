import { Package } from "lucide-react";
import { useEffect, useState } from "react";
import { ApiError, fetchProducts } from "../lib/api";
import { getCachedProducts } from "../lib/offlineQueue";
import type { Product } from "../lib/types";

/** Catálogo / stock visible para el vendedor (lectura). */
export function InventoryPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  return (
    <>
      <header className="page-header">
        <div>
          <p className="eyebrow">Bitácora Campo</p>
          <h1>Inventario</h1>
          <p className="muted">Stock global · precios USD (lista)</p>
        </div>
      </header>

      <section className="card">
        <div className="section-title">
          <span className="icon-badge">
            <Package size={18} />
          </span>
          <h2>Productos</h2>
        </div>
        {loading ? <p className="muted">Cargando…</p> : null}
        {error ? <p className="form-error">{error}</p> : null}
        <ul className="client-list">
          {products.map((p) => (
            <li key={p.id} className="client-item">
              <div>
                <strong>{p.name}</strong>
                <span className="muted"> · {p.sku}</span>
              </div>
              <p className="muted small">
                ${Number(p.price_usd).toFixed(2)} / {p.unit} · stock {p.stock}
              </p>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
