import { Check } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "../components/Button";
import { ListSearch } from "../components/ListSearch";
import { ProductThumb } from "../components/ProductThumb";
import { SelectField } from "../components/TextField";
import { WorkspacePage } from "../layout/WorkspacePage";
import {
  ApiError,
  fetchCatalogVisibility,
  fetchProducts,
  fetchSellers,
  updateCatalogVisibility,
} from "../lib/api";
import { productSearchHay } from "../lib/productFields";
import type { Product, User } from "../lib/types";

/** Catálogo por vendedor — lista tipo ficha + búsqueda. */
export function CatalogVisibilityPage() {
  const [sellers, setSellers] = useState<User[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [sellerId, setSellerId] = useState<number | "">("");
  const [unrestricted, setUnrestricted] = useState(true);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [query, setQuery] = useState("");
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

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return products;
    return products.filter((p) => productSearchHay(p).includes(q));
  }, [products, query]);

  const visibleCount = unrestricted ? products.length : selected.size;
  const selectedSeller = sellers.find((s) => s.id === sellerId) ?? null;

  function toggleProduct(id: number) {
    if (unrestricted) {
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
    <WorkspacePage
      eyebrow="Operación"
      title="Catálogo"
      blurb="Define qué productos ve y vende cada vendedor."
      asideExtra={
        <section className="card chart-card">
          <h2>Visibilidad</h2>
          <p className="muted small" style={{ marginTop: 0 }}>
            {selectedSeller?.full_name ?? "—"}
          </p>
          <div className="bar-list">
            <div>
              <div className="bar-item-top">
                <span>Productos visibles</span>
                <strong>
                  {visibleCount}/{products.length || "—"}
                </strong>
              </div>
              <div className="bar-track" aria-hidden>
                <div
                  className="bar-fill dark"
                  style={{
                    width: products.length
                      ? `${Math.round((visibleCount / products.length) * 100)}%`
                      : "0%",
                  }}
                />
              </div>
            </div>
          </div>
          <Button
            type="button"
            variant="accent"
            block
            style={{ marginTop: "0.85rem" }}
            disabled={busy || sellerId === ""}
            onClick={() => void onSave()}
          >
            <Check size={18} />
            Guardar
          </Button>
        </section>
      }
    >
      <header className="page-header">
        <div>
          <p className="eyebrow">Supervisor · catálogo</p>
          <h1 className="display-title">Catálogo</h1>
          <p className="muted">
            {unrestricted ? "Catálogo completo" : `${selected.size} seleccionados`} ·{" "}
            {products.length} productos
          </p>
        </div>
        <Button
          type="button"
          variant="accent"
          className="mobile-only-save"
          disabled={busy || sellerId === ""}
          onClick={() => void onSave()}
        >
          <Check size={18} />
          Guardar
        </Button>
      </header>

      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}
      {savedNote ? <p className="offline-banner is-online">{savedNote}</p> : null}

      <div className="catalog-toolbar">
        <SelectField
          id="vis-seller"
          label="Vendedor"
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
        </SelectField>
        <ListSearch
          id="catalog-search"
          value={query}
          onChange={setQuery}
          placeholder="Buscar producto o SKU…"
        />
        <button
          type="button"
          className={unrestricted ? "chip active" : "chip"}
          disabled={busy}
          onClick={selectAllVisible}
        >
          Permitir todos
        </button>
      </div>

      {loading ? <p className="muted">Cargando…</p> : null}

      <ul className="ficha-stack">
        {filtered.map((p) => {
          const on = unrestricted || selected.has(p.id);
          return (
            <li key={p.id}>
              <button
                type="button"
                className={`ficha ficha-select${on ? " is-on" : ""}`}
                onClick={() => toggleProduct(p.id)}
                disabled={busy}
                aria-pressed={on}
              >
                <span className={`ficha-product${on ? " is-on" : ""}`} aria-hidden>
                  <ProductThumb src={p.image_url} alt="" size="md" />
                  {on ? (
                    <span className="ficha-product-check">
                      <Check size={12} />
                    </span>
                  ) : null}
                </span>
                <span className="ficha-body">
                  <span className="ficha-row">
                    <h3 className="ficha-title">{p.name}</h3>
                    <strong className="ficha-amount">${Number(p.price_usd).toFixed(0)}</strong>
                  </span>
                  <p className="ficha-meta">
                    {[p.sku, p.presentation, p.brand, `stock ${p.stock} ${p.unit}`]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      {!loading && filtered.length === 0 ? (
        <p className="muted">Sin coincidencias en el catálogo.</p>
      ) : null}
    </WorkspacePage>
  );
}
