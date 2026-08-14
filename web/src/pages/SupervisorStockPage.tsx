import { PackagePlus } from "lucide-react";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { Button } from "../components/Button";
import { ListSearch } from "../components/ListSearch";
import { ListSkeleton } from "../components/ListSkeleton";
import { SideSheet } from "../components/SideSheet";
import { StockTable, stockState, type StockState } from "../components/StockTable";
import { TextField } from "../components/TextField";
import { WorkspacePage } from "../layout/WorkspacePage";
import { formatDateShort } from "../lib/caracasTime";
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

/** Inventario supervisor: tabla de existencias; ingreso/ajuste en side sheet. */
export function SupervisorStockPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"todos" | StockState>("todos");
  const [sheetOpen, setSheetOpen] = useState(false);
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
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo cargar inventario");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

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

  function openMovement(forProduct?: Product) {
    setOkNote(null);
    setError(null);
    setKind("purchase");
    setQuantity("10");
    setUnitCost("");
    setNotes("");
    setSupplierId("");
    setProductId(forProduct?.id ?? products[0]?.id ?? "");
    setSheetOpen(true);
  }

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
      setSheetOpen(false);
      await reload();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo registrar el movimiento");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <WorkspacePage
        eyebrow="Operación"
        title="Inventario"
        blurb="Stock del almacén. Ingresos y ajustes desde el panel lateral."
        asideExtra={
          <>
            <section className="card chart-card">
              <h2>Bodega</h2>
              <div className="bar-list">
                <div>
                  <div className="bar-item-top">
                    <span>Valor stock</span>
                    <strong>${valueStock.toFixed(0)}</strong>
                  </div>
                </div>
                <div>
                  <div className="bar-item-top">
                    <span>A reponer</span>
                    <strong>{toRestock}</strong>
                  </div>
                </div>
              </div>
            </section>
            <section className="card aside-hint">
              <p className="eyebrow">Movimientos</p>
              <h2 className="aside-hint-title">Últimos ingresos</h2>
              {movements.length === 0 ? (
                <p className="muted small">Aún no hay movimientos.</p>
              ) : (
                <ul className="movements-mini">
                  {movements.slice(0, 6).map((m) => (
                    <li key={m.id}>
                      <strong className="small">
                        {m.product_name} · {m.quantity > 0 ? `+${m.quantity}` : m.quantity}
                      </strong>
                      <span className="muted small">
                        {m.kind === "purchase" ? "Compra" : "Ajuste"}
                        {` · ${formatDateShort(m.created_at)}`}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        }
      >
        <header className="page-header page-header-with-action">
          <div>
            <h1 className="display-title">Inventario</h1>
          </div>
          <Button type="button" variant="accent" onClick={() => openMovement()}>
            <PackagePlus size={18} />
            Ingreso / ajuste
          </Button>
        </header>

        {okNote ? <p className="offline-banner is-online">{okNote}</p> : null}
        {error && !sheetOpen ? (
          <p className="form-error" role="alert">
            {error}
          </p>
        ) : null}

        <div className="list-page-tools">
          <ListSearch
            id="sup-inv-search"
            value={query}
            onChange={setQuery}
            placeholder="Nombre o SKU…"
          />
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
        </div>

        {loading ? <ListSkeleton kind="stock" /> : null}

        {!loading && filtered.length ? (
          <StockTable products={filtered} onRowClick={(p) => openMovement(p)} />
        ) : null}

        {!loading && filtered.length === 0 ? (
          <p className="muted">Sin productos con este filtro.</p>
        ) : null}
      </WorkspacePage>

      <SideSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        eyebrow="Bodega"
        title={kind === "purchase" ? "Ingreso de compra" : "Ajuste de stock"}
        footer={
          <Button
            type="submit"
            form="stock-movement-form"
            variant="accent"
            block
            disabled={busy || productId === ""}
          >
            {busy ? "Guardando…" : "Guardar movimiento"}
          </Button>
        }
      >
        <form id="stock-movement-form" className="route-assign-form" onSubmit={onSubmit}>
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

          {error ? (
            <p className="form-error" role="alert">
              {error}
            </p>
          ) : null}
        </form>
      </SideSheet>
    </>
  );
}
