import type { PaymentMethod, Sale, SaleOrigin } from "../lib/types";

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
  cash_eur: "Efectivo EUR",
  credit: "Crédito",
  pago_movil: "Pago móvil",
};

export function formatSaleWhen(iso: string): string {
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

export function saleItemCount(sale: Sale): number {
  return sale.items?.length ?? 0;
}

export function saleUnitCount(sale: Sale): number {
  return (sale.items ?? []).reduce((n, i) => n + i.quantity, 0);
}

/** Más reciente primero. */
export function sortSalesNewestFirst(sales: Sale[]): Sale[] {
  return [...sales].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );
}
