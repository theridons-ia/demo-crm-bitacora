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

export function quoteMoney(subtotalUsd: number, applyIva: boolean): QuoteMoney {
  const subtotal = roundMoney(subtotalUsd);
  const iva = applyIva ? roundMoney(subtotal * IVA_RATE) : 0;
  const total = roundMoney(subtotal + iva);
  return { subtotal, iva, total, applyIva, rate: IVA_RATE };
}

export function formatUsd(n: number): string {
  return `$ ${n.toFixed(2)}`;
}

export function formatBs(n: number): string {
  return `Bs ${n.toLocaleString("es-VE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/** Una sola moneda de cotización: USD o Bs, nunca las dos a la vez. */
export function formatQuoteAmount(
  usd: number,
  currency: "USD" | "VES",
  fxRate: number | null,
): string {
  if (currency === "VES") {
    if (fxRate == null || fxRate <= 0) return "—";
    return formatBs(usd * fxRate);
  }
  return formatUsd(usd);
}
