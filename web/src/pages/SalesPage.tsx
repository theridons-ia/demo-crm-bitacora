import { Plus, Receipt, ShoppingCart } from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Button } from "../components/Button";
import { TextField } from "../components/TextField";
import {
  ApiError,
  createSale,
  fetchClients,
  fetchProducts,
  fetchSales,
  type SaleCreateInput,
} from "../lib/api";
import { newLocalUuid } from "../lib/offlineDb";
import {
  enqueueCreateSale,
  getCachedClients,
  getCachedProducts,
} from "../lib/offlineQueue";
import type { Client, CurrencyCode, Product, Sale, SaleOrigin } from "../lib/types";

type QtyMap = Record<number, number>;
type StandaloneOrigin = Exclude<SaleOrigin, "visita">;

const ORIGIN_LABEL: Record<SaleOrigin, string> = {
  visita: "Visita",
  mostrador: "Mostrador",
  online: "Online",
};

function formatWhen(iso: string): string {
  try {
    return new Date(iso).toLocaleString("es-VE", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

/** Órdenes: lista + alta sin visita (mostrador / online). */
export function SalesPage() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [composing, setComposing] = useState(false);

  const [clientId, setClientId] = useState<number | "">("");
  const [origin, setOrigin] = useState<StandaloneOrigin>("mostrador");
  const [currency, setCurrency] = useState<CurrencyCode>("USD");
  const [qty, setQty] = useState<QtyMap>({});
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [loadingCatalog, setLoadingCatalog] = useState(false);

  function reload() {
    setLoading(true);
    setError(null);
    if (!navigator.onLine) {
      setSales([]);
      setError(null);
      setLoading(false);
      return;
    }
    fetchSales()
      .then(setSales)
      .catch((err) => {
        setError(err instanceof ApiError ? err.message : "Error al cargar ventas");
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    reload();
  }, []);

  useEffect(() => {
    if (!composing) return;
    let cancelled = false;
    setLoadingCatalog(true);
    (async () => {
      try {
        const [c, p] = navigator.onLine
          ? await Promise.all([fetchClients(), fetchProducts()])
          : await Promise.all([getCachedClients(), getCachedProducts()]);
        if (!cancelled) {
          setClients(c);
          setProducts(p);
          if (c.length && clientId === "") setClientId(c[0].id);
          if (!c.length || !p.length) {
            setFormError("Catálogo incompleto en cache. Conéctate para sincronizar.");
          }
        }
      } catch (err) {
        if (!cancelled) {
          const [c, p] = await Promise.all([getCachedClients(), getCachedProducts()]);
          setClients(c);
          setProducts(p);
          setFormError(
            c.length && p.length
              ? null
              : err instanceof ApiError
                ? err.message
                : "No se pudo cargar catálogo",
          );
        }
      } finally {
        if (!cancelled) setLoadingCatalog(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo al abrir el form
  }, [composing]);

  const total = useMemo(() => {
    return products.reduce((sum, p) => {
      const q = qty[p.id] ?? 0;
      return sum + q * Number(p.price_usd);
    }, 0);
  }, [products, qty]);

  function setProductQty(productId: number, next: number, maxStock: number) {
    const clamped = Math.max(0, Math.min(next, maxStock));
    setQty((prev) => {
      const copy = { ...prev };
      if (clamped === 0) delete copy[productId];
      else copy[productId] = clamped;
      return copy;
    });
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);
    if (clientId === "") {
      setFormError("Selecciona un cliente");
      return;
    }
    const items = Object.entries(qty)
      .map(([pid, quantity]) => ({ product_id: Number(pid), quantity }))
      .filter((line) => line.quantity > 0);
    if (!items.length) {
      setFormError("Agrega al menos un producto");
      return;
    }

    const payload: SaleCreateInput = {
      client_id: clientId,
      origin,
      currency,
      notes: notes.trim() || null,
      items,
      local_uuid: newLocalUuid("sale"),
      created_offline: !navigator.onLine,
    };

    setSubmitting(true);
    try {
      if (!navigator.onLine) {
        await enqueueCreateSale(payload);
        setQty({});
        setNotes("");
        setOrigin("mostrador");
        setCurrency("USD");
        setComposing(false);
        setError(null);
        setFormError(null);
        return;
      }
      const created = await createSale(payload);
      setSales((prev) => [created, ...prev]);
      setQty({});
      setNotes("");
      setOrigin("mostrador");
      setCurrency("USD");
      setComposing(false);
    } catch (err) {
      if (!navigator.onLine || err instanceof TypeError) {
        try {
          await enqueueCreateSale(payload);
          setComposing(false);
          setFormError(null);
          return;
        } catch {
          /* fall through */
        }
      }
      setFormError(err instanceof ApiError ? err.message : "No se pudo crear la venta");
    } finally {
      setSubmitting(false);
    }
  }

  if (composing) {
    return (
      <div className="screen-form">
        <header className="page-header">
          <div>
            <p className="eyebrow">Nueva orden</p>
            <h1>Venta sin visita</h1>
            <p className="muted">Mostrador u online · descuenta stock</p>
          </div>
          <Button variant="ghost" type="button" onClick={() => setComposing(false)}>
            Volver
          </Button>
        </header>

        <form className="card form-stack" onSubmit={onSubmit}>
          <div className="field">
            <label htmlFor="sale-client">Cliente</label>
            <select
              id="sale-client"
              className="input"
              value={clientId === "" ? "" : String(clientId)}
              onChange={(e) => setClientId(e.target.value ? Number(e.target.value) : "")}
              required
              disabled={loadingCatalog}
            >
              <option value="">Selecciona…</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                  {c.rif ? ` · ${c.rif}` : c.ci ? ` · CI ${c.ci}` : ""}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <span className="field-label">Origen</span>
            <div className="id-type-toggle" role="group">
              <button
                type="button"
                className={origin === "mostrador" ? "chip active" : "chip"}
                onClick={() => setOrigin("mostrador")}
              >
                Mostrador
              </button>
              <button
                type="button"
                className={origin === "online" ? "chip active" : "chip"}
                onClick={() => setOrigin("online")}
              >
                Online
              </button>
            </div>
          </div>

          <div className="field">
            <span className="field-label">Moneda</span>
            <div className="id-type-toggle" role="group">
              <button
                type="button"
                className={currency === "USD" ? "chip active" : "chip"}
                onClick={() => setCurrency("USD")}
              >
                USD
              </button>
              <button
                type="button"
                className={currency === "VES" ? "chip active" : "chip"}
                onClick={() => setCurrency("VES")}
              >
                Bs (VES)
              </button>
            </div>
          </div>

          {loadingCatalog ? <p className="muted">Cargando productos…</p> : null}

          <ul className="product-pick-list">
            {products.map((product) => {
              const q = qty[product.id] ?? 0;
              return (
                <li key={product.id} className="product-pick-row">
                  <div>
                    <strong>{product.name}</strong>
                    <p className="muted small">
                      {product.sku} · ${Number(product.price_usd).toFixed(2)} / {product.unit} · stock{" "}
                      {product.stock}
                    </p>
                  </div>
                  <div className="qty-controls">
                    <button
                      type="button"
                      className="qty-btn"
                      onClick={() => setProductQty(product.id, q - 1, product.stock)}
                      disabled={q <= 0}
                    >
                      −
                    </button>
                    <span className="qty-value">{q}</span>
                    <button
                      type="button"
                      className="qty-btn"
                      onClick={() => setProductQty(product.id, q + 1, product.stock)}
                      disabled={q >= product.stock}
                    >
                      +
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>

          <p className="sale-total">
            Total estimado: <strong>${total.toFixed(2)} USD</strong>
            {currency === "VES" ? " · liquidar en Bs" : ""}
          </p>

          <TextField
            id="sale-notes"
            label="Nota"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />

          {formError ? (
            <p className="form-error" role="alert">
              {formError}
            </p>
          ) : null}

          <Button type="submit" variant="accent" block disabled={submitting || loadingCatalog}>
            {submitting ? "Guardando…" : "Confirmar venta"}
          </Button>
        </form>
      </div>
    );
  }

  return (
    <>
      <header className="page-header">
        <div>
          <p className="eyebrow">Bitácora Campo</p>
          <h1>Ventas</h1>
          <p className="muted">Órdenes con o sin visita</p>
        </div>
        <Button type="button" variant="accent" onClick={() => setComposing(true)}>
          <Plus size={18} aria-hidden />
          Nueva
        </Button>
      </header>

      <section className="card">
        <div className="section-title">
          <span className="icon-badge">
            <Receipt size={18} />
          </span>
          <h2>Recientes</h2>
        </div>
        {loading ? <p className="muted">Cargando…</p> : null}
        {error ? <p className="form-error">{error}</p> : null}
        {!loading && !sales.length ? (
          <p className="muted">
            Aún no hay ventas. Cierra una visita con venta o crea una de mostrador/online.
          </p>
        ) : null}
        <ul className="client-list">
          {sales.map((sale) => {
            const name = sale.client?.name ?? `Cliente #${sale.client_id}`;
            const lines = sale.items.reduce((n, i) => n + i.quantity, 0);
            return (
              <li key={sale.id} className="client-item">
                <div>
                  <strong>{name}</strong>
                  <span className="muted">
                    {" "}
                    · {ORIGIN_LABEL[sale.origin]}
                    {sale.visit_id ? ` · visita #${sale.visit_id}` : " · sin visita"}
                  </span>
                </div>
                <p className="muted small">
                  <ShoppingCart size={14} aria-hidden style={{ verticalAlign: "-2px" }} />{" "}
                  ${Number(sale.total_amount).toFixed(2)} {sale.currency} · {lines} uds ·{" "}
                  {formatWhen(sale.created_at)}
                </p>
              </li>
            );
          })}
        </ul>
      </section>
    </>
  );
}
