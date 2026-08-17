import type { CurrencyCode } from "./types";

/** IVA Venezuela: 16%. Líneas sin impuesto; el total de OV suma IVA si está activo. */
export const IVA_RATE = 0.16;

export function roundMoney(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export type QuoteMoney = {
  subtotal: number;
  iva: number;
  total: number;
  applyIva: boolean;
  rate: number;
};

export function quoteMoney(subtotal: number, applyIva: boolean): QuoteMoney {
  const value = roundMoney(subtotal);
  const iva = applyIva ? roundMoney(value * IVA_RATE) : 0;
  const total = roundMoney(value + iva);
  return { subtotal: value, iva, total, applyIva, rate: IVA_RATE };
}

export function formatUsd(n: number): string {
  return `$ ${n.toFixed(2)}`;
}

export function formatBs(n: number): string {
  return `Bs. ${n.toFixed(2)}`;
}

/** Monto ya expresado en la moneda de la cotización. */
export function formatQuoteAmount(amount: number, currency: CurrencyCode): string {
  if (currency === "VES") return formatBs(amount);
  if (currency === "EUR") return `€ ${amount.toFixed(2)}`;
  return formatUsd(amount);
}

/** OV viejas en Bs guardaban USD en las líneas; hay que multiplicar por la tasa. */
export function formatLegacyQuoteAmount(
  usd: number,
  currency: CurrencyCode,
  fxRate: number | null,
): string {
  if (currency === "VES") {
    if (fxRate == null || fxRate <= 0) return "—";
    return formatBs(usd * fxRate);
  }
  return formatQuoteAmount(usd, currency);
}
