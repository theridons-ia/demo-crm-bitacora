import { PackagePlus, Plus } from "lucide-react";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { Button } from "../components/Button";
import { ListSearch } from "../components/ListSearch";
import { ListSkeleton } from "../components/ListSkeleton";
import { PhotoDrop } from "../components/PhotoDrop";
import { PriceAutoField } from "../components/PriceAutoField";
import { SearchPickField } from "../components/SearchPickField";
import { SideSheet } from "../components/SideSheet";
import { StockTable, stockState, type StockState } from "../components/StockTable";
import { SelectField, TextAreaField, TextField } from "../components/TextField";
import { WorkspacePage } from "../layout/WorkspacePage";
import { formatDateShort } from "../lib/caracasTime";
import {
  emptyProductForm,
  parseProductForm,
  PRODUCT_CATEGORIES,
  productMarkupPct,
  productSearchHay,
  productToForm,
} from "../lib/productFields";
import {
  ApiError,
  createProduct,
  createStockMovement,
  fetchFxToday,
  fetchProducts,
  fetchStockMovements,
  fetchSuppliers,
  updateProduct,
  type FxRate,
  type StockMovement,
  type Supplier,
} from "../lib/api";
import {
  derivePriceUsdFromCost,
  derivePriceUsd2,
  derivePriceVes,
  moneyInput,
  priceUsd1CostHint,
  priceUsd2AutoHint,
  priceVesAutoHint,
} from "../lib/productPrices";
import type { Product } from "../lib/types";

/** Inventario supervisor: ficha de producto, ingresos y ajustes. */
export function SupervisorStockPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"todos" | StockState>("todos");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [createForm, setCreateForm] = useState(emptyProductForm);
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
  const [fx, setFx] = useState<FxRate | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [p, s, m, rate] = await Promise.all([
        fetchProducts(),
        fetchSuppliers(),
        fetchStockMovements(),
        fetchFxToday().catch(() => null),
      ]);
      setProducts(p);
      setSuppliers(s);
      setMovements(m);
      setFx(rate);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo cargar inventario");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    if (!createOpen) return;
    let cancelled = false;
    fetchFxToday()
      .then((rate) => {
        if (!cancelled) setFx(rate);
      })
      .catch(() => {
        if (!cancelled) setFx(null);
      });
    return () => {
      cancelled = true;
    };
  }, [createOpen]);

  useEffect(() => {
    if (!createOpen) return;
    setCreateForm((prev) => {
      let price_usd = prev.price_usd;
      let price_usd_2 = prev.price_usd_2;
      let price_ves = prev.price_ves;
      if (prev.price_usd_auto) {
        const cost = Number(prev.cost_usd);
        const pct = Number(prev.price_usd_margin_pct);
        const derived = derivePriceUsdFromCost(cost, pct);
        if (derived != null) price_usd = moneyInput(derived);
      }
      if (prev.price_usd_2_auto && price_usd.trim()) {
        const p1 = Number(price_usd);
        const derived = derivePriceUsd2(Number.isFinite(p1) ? p1 : 0, fx);
        if (derived != null) price_usd_2 = moneyInput(derived);
      }
      if (prev.price_ves_auto && price_usd_2.trim()) {
        const p2 = Number(price_usd_2);
        const derived = derivePriceVes(Number.isFinite(p2) ? p2 : null, fx);
        if (derived != null) price_ves = moneyInput(derived);
      }
      if (
        price_usd === prev.price_usd &&
        price_usd_2 === prev.price_usd_2 &&
        price_ves === prev.price_ves
      ) {
        return prev;
      }
      return { ...prev, price_usd, price_usd_2, price_ves };
    });
  }, [
    createOpen,
    fx,
    createForm.price_usd,
    createForm.price_usd_2,
    createForm.cost_usd,
    createForm.price_usd_margin_pct,
    createForm.price_usd_auto,
    createForm.price_usd_2_auto,
    createForm.price_ves_auto,
  ]);

  const valueStock = useMemo(
    () => products.reduce((acc, p) => acc + Number(p.price_usd) * p.stock, 0),
    [products],
  );
  const toRestock = useMemo(
    () => products.filter((p) => stockState(p.stock, p.min_stock) !== "disponible").length,
    [products],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products.filter((p) => {
      const st = stockState(p.stock, p.min_stock);
      if (status !== "todos" && st !== status) return false;
      if (!q) return true;
      return productSearchHay(p).includes(q);
    });
  }, [products, query, status]);

  function openCreate() {
    setOkNote(null);
    setError(null);
    setEditing(null);
    setCreateForm(emptyProductForm);
    setCreateOpen(true);
  }

  function openEdit(product: Product) {
    setOkNote(null);
    setError(null);
    setEditing(product);
    setCreateForm(productToForm(product));
    setCreateOpen(true);
  }

  async function persistProductImage(next: string | null, product: Product) {
    setCreateForm((prev) => ({ ...prev, image_url: next }));
    try {
      const updated = await updateProduct(product.id, { image_url: next });
      setEditing(updated);
      setProducts((prev) => prev.map((row) => (row.id === updated.id ? updated : row)));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo guardar la foto");
    }
  }

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

  async function onSaveProduct(event: FormEvent) {
    event.preventDefault();
    const parsed = parseProductForm(createForm);
    if (parsed.error !== null) {
      setError(parsed.error);
      return;
    }
    if (!editing && !parsed.data.sku) {
      setError("SKU y nombre son obligatorios");
      return;
    }
    const stock = Number(createForm.stock);
    if (!editing && (!Number.isFinite(stock) || stock < 0)) {
      setError("Stock inicial inválido");
      return;
    }
    setBusy(true);
    setError(null);
    setOkNote(null);
    try {
      const { sku, ...fields } = parsed.data;
      if (editing) {
        const updated = await updateProduct(editing.id, fields);
        setCreateOpen(false);
        setEditing(null);
        setCreateForm(emptyProductForm);
        setOkNote(`${updated.name} actualizado`);
      } else {
        const created = await createProduct({
          sku: sku ?? "",
          ...fields,
          stock,
        });
        setCreateOpen(false);
        setCreateForm(emptyProductForm);
        setOkNote(`${created.name} creado · ${created.sku}`);
      }
      await reload();
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : editing
            ? "No se pudo guardar el producto"
            : "No se pudo crear el producto",
      );
    } finally {
      setBusy(false);
    }
  }

  const costNum = createForm.cost_usd.trim() ? Number(createForm.cost_usd) : null;
  const marginPctInput = createForm.price_usd_margin_pct.trim()
    ? Number(createForm.price_usd_margin_pct)
    : null;
  const p1FromCost =
    createForm.price_usd_auto && costNum != null && marginPctInput != null
      ? derivePriceUsdFromCost(costNum, marginPctInput)
      : null;
  const markupPct = productMarkupPct(
    Number(createForm.price_usd),
    costNum,
  );

  return (
    <>
      <WorkspacePage
        eyebrow="Operación"
        title="Inventario"
        blurb="Toca un producto para editarlo. Ingresos y ajustes van en el otro panel."
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
          <div className="page-header-actions">
            <Button type="button" variant="ghost" onClick={openCreate}>
              <Plus size={18} />
              Nuevo producto
            </Button>
            <Button type="button" variant="accent" onClick={() => openMovement()}>
              <PackagePlus size={18} />
              Ingreso / ajuste
            </Button>
          </div>
        </header>

        {okNote ? <p className="offline-banner is-online">{okNote}</p> : null}
        {error && !sheetOpen && !createOpen ? (
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
          <StockTable products={filtered} onRowClick={openEdit} />
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

          <div className="field">
            <span className="field-label" id="stock-product-label">
              Producto
            </span>
            <SearchPickField
              id="stock-product"
              labelledBy="stock-product-label"
              placeholder="Buscar producto…"
              valueId={productId === "" ? null : productId}
              emptyLabel="Sin coincidencias"
              options={products.map((p) => ({
                id: p.id,
                title: p.name,
                subtitle: [p.presentation, p.sku, `stock ${p.stock}`].filter(Boolean).join(" · "),
                imageUrl: p.image_url,
              }))}
              onChange={(id) => setProductId(id ?? "")}
            />
          </div>

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

      <SideSheet
        open={createOpen}
        onClose={() => {
          setCreateOpen(false);
          setEditing(null);
        }}
        size="wide"
        eyebrow="Catálogo"
        title={editing ? "Editar producto" : "Nuevo producto"}
        footer={
          <div className="side-sheet-actions">
            {editing ? (
              <Button
                type="button"
                variant="ghost"
                block
                disabled={busy}
                onClick={() => {
                  const product = editing;
                  setCreateOpen(false);
                  setEditing(null);
                  openMovement(product);
                }}
              >
                <PackagePlus size={18} />
                Ingreso / ajuste
              </Button>
            ) : null}
            <Button type="submit" form="product-create-form" variant="accent" block disabled={busy}>
              {busy ? "Guardando…" : editing ? "Guardar cambios" : "Crear producto"}
            </Button>
          </div>
        }
      >
        <form id="product-create-form" className="route-assign-form product-form" onSubmit={onSaveProduct}>
          <div className="product-form-layout">
            <PhotoDrop
              id="product-photo"
              label="Foto del producto"
              hint={editing ? "Se guarda al elegirla · galería o cámara" : "Opcional · galería o cámara"}
              readyHint={editing ? "Guardada en el producto" : "Se verá en inventario, cotizador y fichas"}
              value={createForm.image_url}
              onChange={(image_url) => {
                if (editing) {
                  void persistProductImage(image_url, editing);
                  return;
                }
                setCreateForm((prev) => ({ ...prev, image_url }));
              }}
              disabled={busy}
            />

            <div className="product-form-block">
              <p className="eyebrow">Identidad</p>
              <div className="product-form-grid">
                <TextField
                  id="product-sku"
                  label="SKU"
                  value={createForm.sku}
                  onChange={(e) => setCreateForm((prev) => ({ ...prev, sku: e.target.value }))}
                  placeholder="HARINA1K"
                  required
                  autoCapitalize="characters"
                  disabled={busy || editing != null}
                  hint={editing ? "Fijo para no romper ventas ya hechas." : undefined}
                />
                <TextField
                  id="product-name"
                  label="Nombre"
                  value={createForm.name}
                  onChange={(e) => setCreateForm((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="Harina P.A.N. 1kg"
                  required
                />
              </div>
              <div className="product-form-grid">
                <TextField
                  id="product-brand"
                  label="Marca"
                  value={createForm.brand}
                  onChange={(e) => setCreateForm((prev) => ({ ...prev, brand: e.target.value }))}
                  placeholder="P.A.N."
                />
                <SelectField
                  id="product-category"
                  label="Categoría"
                  value={createForm.category}
                  onChange={(e) => setCreateForm((prev) => ({ ...prev, category: e.target.value }))}
                >
                  {PRODUCT_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </SelectField>
              </div>
              <div className="product-form-grid">
                <TextField
                  id="product-presentation"
                  label="Presentación"
                  value={createForm.presentation}
                  onChange={(e) => setCreateForm((prev) => ({ ...prev, presentation: e.target.value }))}
                  placeholder="Bolsa 1 kg, caja x12…"
                />
                <TextField
                  id="product-barcode"
                  label="Código de barras"
                  value={createForm.barcode}
                  onChange={(e) => setCreateForm((prev) => ({ ...prev, barcode: e.target.value }))}
                  inputMode="numeric"
                  placeholder="Opcional"
                />
              </div>
            </div>
          </div>

          <div className="product-form-block">
            <p className="eyebrow">Comercial</p>
            <div className="product-form-grid">
              <TextField
                id="product-cost"
                label="Costo USD"
                type="number"
                step="0.01"
                min="0"
                value={createForm.cost_usd}
                onChange={(e) => setCreateForm((prev) => ({ ...prev, cost_usd: e.target.value }))}
                placeholder="0.00"
              />
              <PriceAutoField
                id="product-price"
                label="Precio 1 (USD)"
                value={createForm.price_usd_auto ? createForm.price_usd_margin_pct : createForm.price_usd}
                auto={createForm.price_usd_auto}
                autoLabel="Margen"
                prefix={createForm.price_usd_auto ? "%" : "$"}
                placeholder={createForm.price_usd_auto ? "55" : "0.00"}
                readOnlyWhenAuto={false}
                onAutoChange={(price_usd_auto) =>
                  setCreateForm((prev) => {
                    let price_usd_margin_pct = prev.price_usd_margin_pct;
                    if (price_usd_auto && !price_usd_margin_pct.trim()) {
                      const implied = productMarkupPct(
                        Number(prev.price_usd),
                        prev.cost_usd.trim() ? Number(prev.cost_usd) : null,
                      );
                      if (implied != null) price_usd_margin_pct = moneyInput(implied);
                    }
                    return { ...prev, price_usd_auto, price_usd_margin_pct };
                  })
                }
                onChange={(value) =>
                  setCreateForm((prev) =>
                    prev.price_usd_auto
                      ? { ...prev, price_usd_margin_pct: value }
                      : { ...prev, price_usd: value },
                  )
                }
                hint={
                  createForm.price_usd_auto
                    ? priceUsd1CostHint(costNum, marginPctInput, p1FromCost)
                    : markupPct != null && Number.isFinite(markupPct)
                      ? `Margen ${markupPct.toLocaleString("es-VE", { maximumFractionDigits: 2 })}% vs costo`
                      : undefined
                }
              />
            </div>
            <div className="product-form-grid">
              <PriceAutoField
                id="product-price-2"
                label="Precio 2 (USD)"
                value={createForm.price_usd_2}
                auto={createForm.price_usd_2_auto}
                prefix="$"
                onAutoChange={(price_usd_2_auto) =>
                  setCreateForm((prev) => ({
                    ...prev,
                    price_usd_2_auto,
                  }))
                }
                onChange={(price_usd_2) => setCreateForm((prev) => ({ ...prev, price_usd_2 }))}
                placeholder="0.00"
                hint={createForm.price_usd_2_auto ? priceUsd2AutoHint(fx) : undefined}
              />
              <PriceAutoField
                id="product-price-3"
                label="Precio 3 (Bs)"
                value={createForm.price_ves}
                auto={createForm.price_ves_auto}
                prefix="Bs."
                onAutoChange={(price_ves_auto) => setCreateForm((prev) => ({ ...prev, price_ves_auto }))}
                onChange={(price_ves) => setCreateForm((prev) => ({ ...prev, price_ves }))}
                placeholder="0.00"
                hint={createForm.price_ves_auto ? priceVesAutoHint(fx) : undefined}
              />
            </div>
            <div className="product-form-grid">
              <TextField
                id="product-unit"
                label="Unidad de venta"
                value={createForm.unit}
                onChange={(e) => setCreateForm((prev) => ({ ...prev, unit: e.target.value }))}
                placeholder="unidad, caja, paquete…"
              />
              <TextField
                id="product-pack"
                label="Unidades por empaque"
                type="number"
                min="1"
                value={createForm.pack_units}
                onChange={(e) => setCreateForm((prev) => ({ ...prev, pack_units: e.target.value }))}
                placeholder="1"
              />
            </div>
            <div className="product-form-grid">
              <TextField
                id="product-min-stock"
                label="Stock mínimo"
                type="number"
                min="0"
                value={createForm.min_stock}
                onChange={(e) => setCreateForm((prev) => ({ ...prev, min_stock: e.target.value }))}
              />
              {editing ? (
                <div className="field">
                  <span className="field-label">Stock actual</span>
                  <p className="product-stock-readout">
                    {editing.stock} {editing.unit}
                  </p>
                  <p className="field-hint">Cámbialo con Ingreso / ajuste.</p>
                </div>
              ) : (
                <TextField
                  id="product-stock"
                  label="Stock inicial"
                  type="number"
                  min="0"
                  value={createForm.stock}
                  onChange={(e) => setCreateForm((prev) => ({ ...prev, stock: e.target.value }))}
                />
              )}
            </div>
          </div>

          <div className="product-form-block">
            <p className="eyebrow">Lote vigente</p>
            <div className="product-form-grid">
              <TextField
                id="product-lot"
                label="Lote"
                value={createForm.lot}
                onChange={(e) => setCreateForm((prev) => ({ ...prev, lot: e.target.value }))}
                placeholder="PAN2608"
              />
              <TextField
                id="product-expires"
                label="Fecha de vencimiento"
                type="date"
                value={createForm.expires_on}
                onChange={(e) => setCreateForm((prev) => ({ ...prev, expires_on: e.target.value }))}
              />
            </div>
            <TextAreaField
              id="product-notes"
              label="Notas"
              value={createForm.notes}
              onChange={(e) => setCreateForm((prev) => ({ ...prev, notes: e.target.value }))}
              placeholder="Libre de gluten, UHT, condiciones de guarda…"
            />
          </div>
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
