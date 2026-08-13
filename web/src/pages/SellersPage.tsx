import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { WorkspacePage } from "../layout/WorkspacePage";
import { ApiError, fetchSales, fetchSellers, fetchVisits } from "../lib/api";
import type { Sale, User, Visit } from "../lib/types";

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function isSameDay(iso: string | null | undefined, day: string): boolean {
  if (!iso) return false;
  return iso.slice(0, 10) === day;
}

type SellerRow = {
  seller: User;
  visits: number;
  done: number;
  orders: number;
  salesTotal: number;
  effectiveness: number;
};

/** Lista de vendedores estilo demo (fichas). */
export function SellersPage() {
  const [sellers, setSellers] = useState<User[]>([]);
  const [visits, setVisits] = useState<Visit[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
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
          (s) => s.seller_id === seller.id && isSameDay(s.created_at, day),
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

  return (
    <WorkspacePage
      eyebrow="Equipo"
      title="Vendedores"
      blurb="Fuerza de campo, ventas y efectividad del día."
    >
      <header className="page-header page-header-stack">
        <div>
          <p className="eyebrow">Equipo</p>
          <h1 className="display-title">Vendedores.</h1>
          <p className="muted">
            {sellers.length} vendedor{sellers.length === 1 ? "" : "es"} en la fuerza de campo · hoy
          </p>
        </div>
        <Link to="/sup/ruta" className="btn btn-secondary">
          Asignar ruta
        </Link>
      </header>

      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}
      {loading ? <p className="muted">Cargando…</p> : null}

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
                <p className="ficha-meta">
                  {row.seller.route_name ?? "Sin ruta"}
                </p>
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
        <p className="muted">No hay vendedores activos.</p>
      ) : null}
    </WorkspacePage>
  );
}
