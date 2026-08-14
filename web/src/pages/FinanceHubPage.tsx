import { useEffect, useMemo, useState } from "react";
import {
  Banknote,
  Landmark,
  Receipt,
  ShoppingCart,
  TriangleAlert,
} from "lucide-react";
import { ActionStack } from "../components/ActionStack";
import { MetricGrid, MetricTile } from "../components/MetricTile";
import { WorkspacePage } from "../layout/WorkspacePage";
import {
  ApiError,
  fetchBankAccounts,
  fetchPayables,
  fetchProducts,
  fetchReceivables,
} from "../lib/api";
import { stockState } from "../components/StockTable";

/** Hub Finanzas supervisor — feeling FINA con paleta EnRutas. */
export function FinanceHubPage() {
  const [openCxC, setOpenCxC] = useState(0);
  const [cxcBalance, setCxcBalance] = useState(0);
  const [bankTotal, setBankTotal] = useState(0);
  const [payableOpen, setPayableOpen] = useState(0);
  const [lowStock, setLowStock] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [recv, banks, payables, products] = await Promise.all([
          fetchReceivables({ open_only: true }).catch(() => []),
          fetchBankAccounts().catch(() => []),
          fetchPayables({ open_only: true }).catch(() => []),
          fetchProducts().catch(() => []),
        ]);
        if (cancelled) return;
        setOpenCxC(recv.length);
        setCxcBalance(recv.reduce((a, r) => a + Number(r.balance), 0));
        setBankTotal(banks.reduce((a, b) => a + Number(b.balance || 0), 0));
        setPayableOpen(payables.reduce((a, p) => a + Number(p.amount), 0));
        setLowStock(products.filter((p) => stockState(p.stock, p.min_stock) !== "disponible").length);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof ApiError ? err.message : "No se pudo cargar finanzas");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const actions = useMemo(
    () => [
      {
        key: "cobranza",
        label: "Cobranza / cuentas por cobrar",
        icon: Banknote,
        variant: "primary" as const,
        to: "/sup/cobranza",
      },
      {
        key: "bancos",
        label: "Bancos y cajas",
        icon: Landmark,
        variant: "outline" as const,
        to: "/sup/bancos",
      },
      {
        key: "cxp",
        label: "Cuentas por pagar",
        icon: Receipt,
        variant: "muted" as const,
        to: "/sup/por-pagar",
      },
      {
        key: "ventas",
        label: "Ventas del equipo",
        icon: ShoppingCart,
        variant: "accent" as const,
        to: "/sup/ventas",
      },
    ],
    [],
  );

  return (
    <WorkspacePage
      eyebrow="Finanzas"
      title="Finanzas"
      blurb="Cobranza, bancos y cuentas por pagar."
    >
      <header className="page-header">
        <div>
          <p className="eyebrow">Supervisor · finanzas</p>
          <h1 className="display-title">Finanzas</h1>
          <p className="muted">Resumen operativo del día.</p>
        </div>
      </header>

      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}

      <MetricGrid
        aria-label="Resumen finanzas"
        hero={
          <MetricTile
            label="Por cobrar"
            value={`$${cxcBalance.toFixed(0)}`}
            icon={Banknote}
            tone="solid"
            hint={`${openCxC} cuenta(s) abiertas`}
          />
        }
      >
        <MetricTile
          label="En bancos / cajas"
          value={`$${bankTotal.toFixed(0)}`}
          icon={Landmark}
          tone="success"
        />
        <MetricTile
          label="Por pagar"
          value={`$${payableOpen.toFixed(0)}`}
          icon={Receipt}
          tone="warning"
        />
        <MetricTile
          label="Stock a reponer"
          value={lowStock}
          icon={TriangleAlert}
          tone="accent"
        />
        <MetricTile label="CxC abiertas" value={openCxC} />
      </MetricGrid>

      <ActionStack title="Acciones" items={actions} />
    </WorkspacePage>
  );
}
