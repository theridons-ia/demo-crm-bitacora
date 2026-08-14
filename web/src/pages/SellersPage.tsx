import { Plus } from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { Button } from "../components/Button";
import { ListSkeleton } from "../components/ListSkeleton";
import { SideSheet } from "../components/SideSheet";
import { TextField } from "../components/TextField";
import { WorkspacePage } from "../layout/WorkspacePage";
import { ApiError, createSeller, fetchSales, fetchSellers, fetchVisits } from "../lib/api";
import { isSameCaracasDay, todayISO } from "../lib/caracasTime";
import type { Sale, User, Visit } from "../lib/types";

type SellerRow = {
  seller: User;
  visits: number;
  done: number;
  orders: number;
  salesTotal: number;
  effectiveness: number;
};

const emptyForm = {
  full_name: "",
  email: "",
  password: "demo1234",
  route_name: "",
};

/** Lista de vendedores + alta (supervisor/admin). */
export function SellersPage() {
  const [sellers, setSellers] = useState<User[]>([]);
  const [visits, setVisits] = useState<Visit[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [busy, setBusy] = useState(false);
  const [okNote, setOkNote] = useState<string | null>(null);
  const day = todayISO();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [s, v, saleList] = await Promise.all([
          fetchSellers(),
          fetchVisits({ day }),
          fetchSales().catch(() => []),
        ]);
        if (cancelled) return;
        setSellers(s);
        setVisits(v.filter((x) => x.status !== "cancelada"));
        setSales(saleList);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof ApiError ? err.message : "No se pudo cargar el equipo");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [day]);

  const rows: SellerRow[] = useMemo(() => {
    return sellers
      .map((seller) => {
        const mine = visits.filter((v) => v.seller_id === seller.id);
        const done = mine.filter((v) => v.status === "completada").length;
        const withSale = mine.filter(
          (v) => v.status === "completada" && v.result && v.result !== "sin_venta",
        ).length;
        const sellerSales = sales.filter(
          (s) => s.seller_id === seller.id && isSameCaracasDay(s.created_at, day),
        );
        const salesTotal = sellerSales.reduce((acc, s) => acc + Number(s.total_amount || 0), 0);
        return {
          seller,
          visits: mine.length,
          done,
          orders: sellerSales.length,
          salesTotal,
          effectiveness: done ? Math.round((withSale / done) * 100) : 0,
        };
      })
      .sort((a, b) => b.salesTotal - a.salesTotal || b.done - a.done);
  }, [sellers, visits, sales, day]);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setOkNote(null);
    try {
      let email = form.email.trim().toLowerCase();
      if (email && !email.includes("@")) email = `${email}@bitacora.local`;
      const created = await createSeller({
        full_name: form.full_name.trim(),
        email,
        password: form.password,
        route_name: form.route_name.trim() || null,
      });
      setSellers((prev) =>
        [...prev, created].sort((a, b) => a.full_name.localeCompare(b.full_name, "es")),
      );
      setForm(emptyForm);
      setFormOpen(false);
      setOkNote(`${created.full_name} creado · ${created.email}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo crear el vendedor");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <WorkspacePage
        eyebrow="Equipo"
        title="Vendedores"
        blurb="Fuerza de campo, ventas y efectividad del día. Alta de usuarios desde aquí."
      >
        <header className="page-header page-header-with-action">
          <div>
            <p className="eyebrow">Equipo</p>
            <h1 className="display-title">Vendedores.</h1>
            <p className="muted">
              {sellers.length} vendedor{sellers.length === 1 ? "" : "es"} en la fuerza de campo · hoy
            </p>
          </div>
          <div className="page-header-actions">
            <Link to="/sup/ruta" className="btn btn-secondary">
              Asignar ruta
            </Link>
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
          </div>
        </header>

        {okNote ? <p className="offline-banner is-online">{okNote}</p> : null}
        {error && !formOpen ? (
          <p className="form-error" role="alert">
            {error}
          </p>
        ) : null}
        {loading ? <ListSkeleton count={4} /> : null}

        <ul className="ficha-stack">
          {rows.map((row) => (
            <li key={row.seller.id}>
              <article className="ficha ficha-seller">
                <span className="ficha-avatar" aria-hidden>
                  {row.seller.initials || "—"}
                </span>
                <div className="ficha-body">
                  <div className="ficha-row">
                    <h3 className="ficha-title">{row.seller.full_name}</h3>
                    <strong className="ficha-amount">${row.salesTotal.toFixed(0)}</strong>
                  </div>
                  <p className="ficha-meta">{row.seller.route_name ?? "Sin ruta"}</p>
                  <p className="ficha-stats">
                    {row.done}/{row.visits} visitas · {row.orders} órdenes · {row.effectiveness}%
                    efectividad
                  </p>
                </div>
              </article>
            </li>
          ))}
        </ul>

        {!loading && rows.length === 0 ? (
          <p className="muted">No hay vendedores activos. Crea el primero.</p>
        ) : null}
      </WorkspacePage>

      <SideSheet
        open={formOpen}
        onClose={() => setFormOpen(false)}
        eyebrow="Equipo"
        title="Nuevo vendedor"
        blurb="Crea un usuario de campo. Podrá entrar con su email y contraseña."
        footer={
          <div className="side-sheet-actions">
            <Button type="button" variant="ghost" disabled={busy} onClick={() => setFormOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" form="seller-create-form" variant="accent" disabled={busy}>
              {busy ? "Creando…" : "Crear usuario"}
            </Button>
          </div>
        }
      >
        <form id="seller-create-form" className="sheet-form-stack" onSubmit={(e) => void onCreate(e)}>
          <TextField
            id="seller-name"
            label="Nombre completo"
            value={form.full_name}
            onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))}
            required
            minLength={3}
            autoComplete="name"
          />
          <TextField
            id="seller-email"
            label="Email"
            type="text"
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            required
            hint="Si omites el dominio, se usa @bitacora.local"
            placeholder="arodriguez@bitacora.local"
            autoComplete="off"
          />
          <TextField
            id="seller-password"
            label="Contraseña"
            type="text"
            value={form.password}
            onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
            required
            minLength={6}
            hint="Mínimo 6 caracteres. La misma que usará en el login."
          />
          <TextField
            id="seller-route"
            label="Ruta / zona"
            value={form.route_name}
            onChange={(e) => setForm((f) => ({ ...f, route_name: e.target.value }))}
            placeholder="Valencia · Puerto Cabello"
          />
          {error && formOpen ? (
            <p className="form-error" role="alert">
              {error}
            </p>
          ) : null}
        </form>
      </SideSheet>
    </>
  );
}
