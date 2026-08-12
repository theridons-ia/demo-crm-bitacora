import { PackagePlus } from "lucide-react";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Button } from "../components/Button";
import { TextField } from "../components/TextField";
import {
  ApiError,
  createStockMovement,
  fetchProducts,
  fetchStockMovements,
  fetchSuppliers,
  type StockMovement,
  type Supplier,
} from "../lib/api";
import type { Product } from "../lib/types";

/** SF-3.1 — ingresos de compra y ajustes de stock (supervisor). */
export function SupervisorStockPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [productId, setProductId] = useState<number | "">("");
  const [supplierId, setSupplierId] = useState<number | "">("");
  const [kind, setKind] = useState<"purchase" | "adjustment">("purchase");
  const [quantity, setQuantity] = useState("10");
  const [unitCost, setUnitCost] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [okNote, setOkNote] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [p, s, m] = await Promise.all([
        fetchProducts(),
        fetchSuppliers(),
        fetchStockMovements(),
      ]);
      setProducts(p);
      setSuppliers(s);
      setMovements(m);
      setProductId((prev) => (prev !== "" && p.some((x) => x.id === prev) ? prev : p[0]?.id ?? ""));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo cargar inventario");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (productId === "") return;
    const qty = Number(quantity);
    if (!Number.isFinite(qty) || qty === 0) {
      setError("Cantidad inválida");
      return;
    }
    setBusy(true);
    setError(null);
    setOkNote(null);
    try {
      const movement = await createStockMovement({
        product_id: productId,
        kind,
        quantity: kind === "purchase" ? Math.abs(qty) : qty,
        supplier_id: supplierId === "" ? null : supplierId,
        unit_cost_usd: unitCost.trim() ? Number(unitCost) : null,
        notes: notes.trim() || null,
      });
      setOkNote(
        `${movement.kind === "purchase" ? "Ingreso" : "Ajuste"}: ${movement.product_name} · stock ahora ${movement.stock_after}`,
      );
      setNotes("");
      await reload();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo registrar el movimiento");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <header className="page-header page-header-stack">
        <div>
          <p className="eyebrow">Supervisor · operación</p>
          <h1 className="display-title">Inventario e ingresos.</h1>
          <p className="muted">
            Compra a proveedor o ajuste manual. El stock global sube/baja al instante.
          </p>
        </div>
      </header>

      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}
      {okNote ? <p className="offline-banner is-online">{okNote}</p> : null}

      <section className="card seller-panel">
        <div className="seller-panel-head">
          <h2 className="section-heading">Registrar movimiento</h2>
          <PackagePlus size={20} aria-hidden />
        </div>

        <form className="route-assign-form" onSubmit={onSubmit}>
          <div className="filter-chips" role="tablist" aria-label="Tipo de movimiento">
            <button
              type="button"
              className={kind === "purchase" ? "chip active" : "chip"}
              onClick={() => setKind("purchase")}
            >
              Compra / ingreso
            </button>
            <button
              type="button"
              className={kind === "adjustment" ? "chip active" : "chip"}
              onClick={() => setKind("adjustment")}
            >
              Ajuste (+/−)
            </button>
          </div>

          <label className="field" htmlFor="stock-product">
            <span className="field-label">Producto</span>
            <select
              id="stock-product"
              className="input"
              value={productId === "" ? "" : String(productId)}
              onChange={(e) => setProductId(e.target.value ? Number(e.target.value) : "")}
              required
              disabled={loading}
            >
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} · stock {p.stock}
                </option>
              ))}
            </select>
          </label>

          {kind === "purchase" ? (
            <label className="field" htmlFor="stock-supplier">
              <span className="field-label">Proveedor (opcional)</span>
              <select
                id="stock-supplier"
                className="input"
                value={supplierId === "" ? "" : String(supplierId)}
                onChange={(e) => setSupplierId(e.target.value ? Number(e.target.value) : "")}
              >
                <option value="">Sin proveedor</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          <TextField
            id="stock-qty"
            label={kind === "purchase" ? "Cantidad a ingresar" : "Cantidad (+ entra / − sale)"}
            type="number"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            required
          />

          {kind === "purchase" ? (
            <TextField
              id="stock-cost"
              label="Costo unitario USD (opcional)"
              type="number"
              step="0.01"
              value={unitCost}
              onChange={(e) => setUnitCost(e.target.value)}
            />
          ) : null}

          <TextField
            id="stock-notes"
            label="Nota"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Factura, motivo del ajuste…"
          />

          <Button type="submit" variant="accent" block disabled={busy || productId === ""}>
            Guardar movimiento
          </Button>
        </form>
      </section>

      <section className="card seller-panel" style={{ marginTop: "0.85rem" }}>
        <h2 className="section-heading">Existencias</h2>
        {loading ? <p className="muted">Cargando…</p> : null}
        <ul className="inv-list">
          {products.map((p) => (
            <li key={p.id} className="inv-row">
              <div className="inv-body">
                <div className="inv-top">
                  <strong>{p.name}</strong>
                  <span className="status-pill status-ok">{p.stock} u.</span>
                </div>
                <p className="muted small">
                  {p.sku} · ${Number(p.price_usd).toFixed(2)}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="card seller-panel" style={{ marginTop: "0.85rem" }}>
        <h2 className="section-heading">Últimos movimientos</h2>
        {movements.length === 0 ? (
          <p className="muted">Aún no hay movimientos.</p>
        ) : (
          <ul className="upcoming-list">
            {movements.map((m) => (
              <li key={m.id} className="upcoming-item">
                <span
                  className="upcoming-dot"
                  style={{ background: m.quantity >= 0 ? "var(--success)" : "var(--destructive)" }}
                  aria-hidden
                />
                <div>
                  <p className="upcoming-name">
                    {m.product_name} · {m.quantity > 0 ? `+${m.quantity}` : m.quantity}
                  </p>
                  <p className="muted small">
                    {m.kind === "purchase" ? "Compra" : "Ajuste"}
                    {m.supplier_name ? ` · ${m.supplier_name}` : ""}
                    {m.created_by_name ? ` · ${m.created_by_name}` : ""}
                    {` · ${new Date(m.created_at).toLocaleString("es-VE", {
                      dateStyle: "short",
                      timeStyle: "short",
                    })}`}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
