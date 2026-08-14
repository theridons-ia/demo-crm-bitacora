import { Plus, Truck } from "lucide-react";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { Button } from "../components/Button";
import { ListSearch } from "../components/ListSearch";
import { ListSkeleton } from "../components/ListSkeleton";
import { Modal } from "../components/Modal";
import { SideSheet } from "../components/SideSheet";
import { TextAreaField, TextField } from "../components/TextField";
import { WorkspacePage } from "../layout/WorkspacePage";
import { ApiError, createSupplier, fetchSuppliers, type Supplier } from "../lib/api";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

function idLabel(s: Supplier): string {
  if (s.rif) return `RIF ${s.rif}`;
  if (s.ci) return `CI ${s.ci}`;
  return "Sin identificación";
}

const emptyForm = {
  name: "",
  rif: "",
  phone: "",
  email: "",
  notes: "",
};

/** Proveedores: lista, ficha y alta (supervisor/admin). */
export function SuppliersPage() {
  const [rows, setRows] = useState<Supplier[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<Supplier | null>(null);
  const [okNote, setOkNote] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setRows(await fetchSuppliers());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo cargar proveedores");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((s) =>
      `${s.name} ${s.rif ?? ""} ${s.ci ?? ""} ${s.phone ?? ""} ${s.email ?? ""}`
        .toLowerCase()
        .includes(q),
    );
  }, [rows, query]);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const created = await createSupplier({
        name: form.name.trim(),
        rif: form.rif.trim() || null,
        phone: form.phone.trim() || null,
        email: form.email.trim() || null,
        notes: form.notes.trim() || null,
      });
      setRows((prev) => [created, ...prev.filter((s) => s.id !== created.id)]);
      setForm(emptyForm);
      setFormOpen(false);
      setSelected(created);
      setOkNote(`${created.name} registrado`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo registrar el proveedor");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <WorkspacePage
        eyebrow="Compras"
        title="Proveedores"
        blurb="Fichas de proveedores para inventario y cuentas por pagar."
      >
        <header className="page-header page-header-with-action">
          <div>
            <p className="eyebrow">Compras</p>
            <h1 className="display-title">Proveedores.</h1>
            <p className="muted">{rows.length} activos</p>
          </div>
          <Button
            type="button"
            variant="accent"
            className="header-plus-cta"
            onClick={() => {
              setError(null);
              setFormOpen(true);
            }}
          >
            <Plus size={18} />
            Nuevo
          </Button>
        </header>

        {okNote ? <p className="offline-banner is-online">{okNote}</p> : null}
        {error && !formOpen ? (
          <p className="form-error" role="alert">
            {error}
          </p>
        ) : null}

        <div className="list-page-tools">
          <ListSearch
            id="sup-suppliers-search"
            value={query}
            onChange={setQuery}
            placeholder="Nombre, RIF o teléfono…"
          />
        </div>

        {loading ? <ListSkeleton count={4} /> : null}

        <ul className="ficha-stack">
          {filtered.map((s) => (
            <li key={s.id}>
              <button type="button" className="ficha" onClick={() => setSelected(s)}>
                <span className="ficha-icon tone-muted" aria-hidden>
                  <Truck size={18} />
                </span>
                <div className="ficha-body">
                  <div className="ficha-row">
                    <h3 className="ficha-title">{s.name}</h3>
                  </div>
                  <p className="ficha-meta">{idLabel(s)}</p>
                  <p className="ficha-stats">
                    {[s.phone, s.email].filter(Boolean).join(" · ") || "Sin contacto"}
                  </p>
                </div>
              </button>
            </li>
          ))}
        </ul>

        {!loading && filtered.length === 0 ? (
          <p className="muted">Sin coincidencias. Crea un proveedor.</p>
        ) : null}
      </WorkspacePage>

      <SideSheet
        open={formOpen}
        onClose={() => setFormOpen(false)}
        eyebrow="Proveedor"
        title="Registrar proveedor"
        blurb="RIF o CI, uno solo. Queda disponible para ingresos de stock."
        footer={
          <div className="side-sheet-actions">
            <Button type="button" variant="ghost" disabled={busy} onClick={() => setFormOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" form="supplier-create-form" variant="accent" disabled={busy}>
              {busy ? "Guardando…" : "Registrar"}
            </Button>
          </div>
        }
      >
        <form
          id="supplier-create-form"
          className="sheet-form-stack"
          onSubmit={(e) => void onCreate(e)}
        >
          <TextField
            id="sup-name"
            label="Nombre"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            required
            minLength={2}
          />
          <TextField
            id="sup-rif"
            label="RIF"
            value={form.rif}
            onChange={(e) => setForm((f) => ({ ...f, rif: e.target.value }))}
            required
            placeholder="J-00011222-3"
          />
          <TextField
            id="sup-phone"
            label="Teléfono"
            value={form.phone}
            onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
          />
          <TextField
            id="sup-email"
            label="Email"
            type="email"
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
          />
          <TextAreaField
            id="sup-notes"
            label="Notas"
            value={form.notes}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
          />
          {error && formOpen ? (
            <p className="form-error" role="alert">
              {error}
            </p>
          ) : null}
        </form>
      </SideSheet>

      {selected ? (
        <Modal
          open
          onClose={() => setSelected(null)}
          eyebrow="Ficha de proveedor"
          title={selected.name}
          blurb={idLabel(selected)}
          footer={
            <div className="side-sheet-actions">
              <Button type="button" variant="accent" onClick={() => setSelected(null)}>
                Cerrar
              </Button>
            </div>
          }
        >
          <div className="profile-ficha">
            <div className="visit-ficha-id">
              <span className="visit-ficha-avatar" aria-hidden>
                {initials(selected.name)}
              </span>
              <div className="visit-ficha-id-copy">
                <p className="eyebrow">Proveedor</p>
                <strong>{selected.name}</strong>
                <span className="muted small">{idLabel(selected)}</span>
              </div>
              <span className={`badge ${selected.is_active ? "badge-completada" : "badge-programada"}`}>
                {selected.is_active ? "Activo" : "Inactivo"}
              </span>
            </div>
            <div className="visit-ficha-facts">
              <article className="visit-ficha-fact">
                <span className="muted small">Identificación</span>
                <strong>{idLabel(selected)}</strong>
              </article>
              <article className="visit-ficha-fact">
                <span className="muted small">Teléfono</span>
                <strong>
                  {selected.phone ? (
                    <a className="profile-ficha-link" href={`tel:${selected.phone.replace(/\s+/g, "")}`}>
                      {selected.phone}
                    </a>
                  ) : (
                    "Sin teléfono"
                  )}
                </strong>
              </article>
              <article className="visit-ficha-fact visit-ficha-fact-wide">
                <span className="muted small">Email</span>
                <strong>
                  {selected.email ? (
                    <a className="profile-ficha-link" href={`mailto:${selected.email}`}>
                      {selected.email}
                    </a>
                  ) : (
                    "Sin email"
                  )}
                </strong>
              </article>
              {selected.notes ? (
                <article className="visit-ficha-fact visit-ficha-fact-wide">
                  <span className="muted small">Notas</span>
                  <strong>{selected.notes}</strong>
                </article>
              ) : null}
            </div>
          </div>
        </Modal>
      ) : null}
    </>
  );
}
