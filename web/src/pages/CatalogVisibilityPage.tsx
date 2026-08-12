import { Check, Package } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Button } from "../components/Button";
import {
  ApiError,
  fetchCatalogVisibility,
  fetchProducts,
  fetchSellers,
  updateCatalogVisibility,
} from "../lib/api";
import type { Product, User } from "../lib/types";

/** SF-2.4 — qué productos ve/vende cada vendedor. */
export function CatalogVisibilityPage() {
  const [sellers, setSellers] = useState<User[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [sellerId, setSellerId] = useState<number | "">("");
  const [unrestricted, setUnrestricted] = useState(true);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedNote, setSavedNote] = useState<string | null>(null);

  const loadMeta = useCallback(async () => {
    const [sellerList, productList] = await Promise.all([fetchSellers(), fetchProducts()]);
    setSellers(sellerList);
    setProducts(productList);
    setSellerId((prev) => {
      if (prev !== "" && sellerList.some((s) => s.id === prev)) return prev;
      return sellerList[0]?.id ?? "";
    });
  }, []);

  const loadVisibility = useCallback(async (sid: number) => {
    const vis = await fetchCatalogVisibility(sid);
    setUnrestricted(vis.unrestricted);
    setSelected(new Set(vis.product_ids));
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        await loadMeta();
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof ApiError ? err.message : "No se pudo cargar el catálogo");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadMeta]);

  useEffect(() => {
    if (sellerId === "") return;
    let cancelled = false;
    (async () => {
      setError(null);
      setSavedNote(null);
      try {
        await loadVisibility(sellerId);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof ApiError ? err.message : "No se pudo cargar la visibilidad");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sellerId, loadVisibility]);

  function toggleProduct(id: number) {
    if (unrestricted) {
      // Salir de “todos”: queda el catálogo menos el desmarcado
      setUnrestricted(false);
      setSelected(new Set(products.map((p) => p.id).filter((pid) => pid !== id)));
      return;
    }
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAllVisible() {
    setUnrestricted(true);
    setSelected(new Set());
  }

  async function onSave() {
    if (sellerId === "") return;
    setBusy(true);
    setError(null);
    setSavedNote(null);
    try {
      const result = await updateCatalogVisibility(sellerId, {
        unrestricted,
        product_ids: unrestricted ? [] : Array.from(selected),
      });
      setUnrestricted(result.unrestricted);
      setSelected(new Set(result.product_ids));
      setSavedNote(
        result.unrestricted
          ? "Guardado: ve todo el catálogo"
          : `Guardado: ${result.product_ids.length} producto(s)`,
      );
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo guardar");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <header className="page-header">
        <div>
          <p className="eyebrow">Supervisor</p>
          <h1>Catálogo por vendedor</h1>
          <p className="muted">
            Sin restricción = ve todo. Con selección = solo esos productos en Inventario y
            ventas.
          </p>
        </div>
      </header>

      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}
      {savedNote ? <p className="offline-banner is-online">{savedNote}</p> : null}

      <section className="card route-filters">
        <label className="field" htmlFor="vis-seller">
          <span className="field-label">Vendedor</span>
          <select
            id="vis-seller"
            className="input"
            value={sellerId === "" ? "" : String(sellerId)}
            onChange={(e) => setSellerId(e.target.value ? Number(e.target.value) : "")}
            disabled={loading || sellers.length === 0}
          >
            {sellers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.full_name}
                {s.route_name ? ` · ${s.route_name}` : ""}
              </option>
            ))}
          </select>
        </label>
        <div className="vis-mode">
          <p className="muted small" style={{ margin: "0 0 0.5rem" }}>
            Modo:{" "}
            <strong>{unrestricted ? "Catálogo completo" : `${selected.size} seleccionados`}</strong>
          </p>
          <Button type="button" variant="secondary" onClick={selectAllVisible} disabled={busy}>
            Permitir todos
          </Button>
        </div>
      </section>

      <section className="card">
        <div className="section-title" style={{ marginBottom: "0.85rem" }}>
          <span className="icon-badge">
            <Package size={18} />
          </span>
          <h2 className="section-title">Productos</h2>
        </div>

        {loading ? <p className="muted">Cargando…</p> : null}

        <ul className="vis-product-list">
          {products.map((p) => {
            const on = unrestricted || selected.has(p.id);
            return (
              <li key={p.id}>
                <label className={`vis-product-row${on ? " is-on" : ""}`}>
                  <input
                    type="checkbox"
                    checked={on}
                    onChange={() => toggleProduct(p.id)}
                    disabled={busy}
                  />
                  <span>
                    <strong>{p.name}</strong>
                    <span className="muted"> · {p.sku}</span>
                    <br />
                    <span className="muted small">
                      ${Number(p.price_usd).toFixed(2)} · stock {p.stock}
                    </span>
                  </span>
                </label>
              </li>
            );
          })}
        </ul>

        <Button type="button" variant="accent" block disabled={busy || sellerId === ""} onClick={() => void onSave()}>
          <Check size={18} />
          Guardar visibilidad
        </Button>
      </section>
    </>
  );
}
