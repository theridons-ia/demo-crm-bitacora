import { formatDateTime, formatSaleStamp } from "./caracasTime";
import type { PaymentMethod, Sale, SaleOrigin } from "./types";

export const SALE_ORIGIN_LABEL: Record<SaleOrigin, string> = {
  visita: "Visita",
  mostrador: "Mostrador",
  online: "Online",
};

export const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = {
  cash_usd: "Efectivo USD",
  zelle: "Zelle",
  usdt: "USDT",
  cash_ves: "Efectivo Bs",
  transfer_ves: "Transferencia",
  transfer_usd: "Banco US",
  cash_eur: "Efectivo EUR",
  credit: "Crédito",
  pago_movil: "Pago móvil",
};

export function formatSaleWhen(iso: string): string {
  return formatDateTime(iso);
}

export function saleItemCount(sale: Sale): number {
  return sale.items?.length ?? 0;
}

export function saleUnitCount(sale: Sale): number {
  return (sale.items ?? []).reduce((n, i) => n + i.quantity, 0);
}

/** Total en la moneda de la OV. USD y Bs son ventas distintas; no mezclar símbolos. */
export function formatSaleTotal(sale: Pick<Sale, "total_amount" | "currency">): string {
  const n = Number(sale.total_amount);
  const x = Number.isFinite(n) ? n.toFixed(2) : "0.00";
  if (sale.currency === "VES") return `Bs. ${x}`;
  if (sale.currency === "EUR") return `€ ${x}`;
  return `$ ${x}`;
}

export function saleCurrencyLabel(currency: Sale["currency"]): string {
  if (currency === "VES") return "Bs";
  if (currency === "EUR") return "EUR";
  return "USD";
}

/** Más reciente primero. */
export function sortSalesNewestFirst(sales: Sale[]): Sale[] {
  return [...sales].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );
}

function normalizePedidoCode(code: string): string {
  if (code.startsWith("OV-")) return `PED-${code.slice("OV-".length)}`;
  if (code.startsWith("PED-")) return code;
  return code;
}

/** Código de pedido confirmada (snapshot) o sello PED-YYMMDD-HHMM-id. */
export function saleOrderCode(sale: Sale): string {
  if (sale.quote_snapshot?.trim()) {
    try {
      const data = JSON.parse(sale.quote_snapshot) as { code?: unknown };
      const code = typeof data?.code === "string" ? data.code.trim() : "";
      if (code && !/^OV-\d+$/.test(code)) return normalizePedidoCode(code);
    } catch {
      /* snapshot viejo o corrupto */
    }
  }
  return normalizePedidoCode(formatSaleStamp(sale.created_at, sale.id));
}

/** Notas de cierre antiguas «Cierre con OV-41» → código actual. */
export function rewriteCloseNote(description: string | null | undefined, sale: Sale | null): string | null {
  if (!description?.trim()) return null;
  if (!sale) return visitNoteForUi(description);
  const code = saleOrderCode(sale);
  const next = description
    // Legacy: “OV-41”
    .replace(/\b(?:OV|PED)-\d+\b/g, code)
    // Sello: “OV-YYMMDD-HHMM-0001”
    .replace(/\b(?:OV|PED)-\d{6}-\d{4}-\d{4}\b/g, code);

  if (/^Cierre con (?:OV|PED)-[\w-]+\s*$/i.test(next.trim())) return null;
  return visitNoteForUi(next);
}

const SYSTEM_VISIT_NOTE =
  /^(Ruta Ali ·|Ruta hoy ·|Sin asistir ·|Cierre con (?:OV|PED)-|Cancelada$|Cierre demo)/i;

/** Nota de campo para UI: oculta marcadores de seed/cierre automático. */
export function visitNoteForUi(description: string | null | undefined): string | null {
  const text = description?.trim() || "";
  if (!text || SYSTEM_VISIT_NOTE.test(text)) return null;
  return text;
}
