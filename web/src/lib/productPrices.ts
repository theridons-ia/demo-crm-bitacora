import type { FxRate } from "./api";
import type { CurrencyCode, Product } from "./types";

/** USDT ÷ BCV. Ej. 1.13 */
export function usdtBcvSpread(fx: Pick<FxRate, "usd_to_ves" | "usdt_to_ves"> | null): number | null {
  const bcv = Number(fx?.usd_to_ves);
  const usdt = Number(fx?.usdt_to_ves);
  if (!(bcv > 0) || !(usdt > 0)) return null;
  return usdt / bcv;
}

function spreadRatioLabel(fx: Pick<FxRate, "usd_to_ves" | "usdt_to_ves"> | null): string | null {
  const spread = usdtBcvSpread(fx);
  if (spread == null) return null;
  return spread.toLocaleString("es-VE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function derivePriceUsd2(price1: number, fx: Pick<FxRate, "usd_to_ves" | "usdt_to_ves"> | null): number | null {
  const spread = usdtBcvSpread(fx);
  if (spread == null || !(price1 >= 0) || !Number.isFinite(price1)) return null;
  return Math.round(price1 * spread * 100) / 100;
}

/** Precio 1 = costo × (1 + margen%). Costo $1 y 55% → $1.55. */
export function derivePriceUsdFromCost(cost: number, marginPct: number): number | null {
  if (!(cost > 0) || !Number.isFinite(marginPct) || marginPct < 0) return null;
  return Math.round(cost * (1 + marginPct / 100) * 100) / 100;
}

export function derivePriceVes(price2: number | null, fx: Pick<FxRate, "usd_to_ves"> | null): number | null {
  const bcv = Number(fx?.usd_to_ves);
  if (price2 == null || !(price2 >= 0) || !(bcv > 0)) return null;
  return Math.round(price2 * bcv * 100) / 100;
}

export function moneyInput(n: number | null): string {
  if (n == null || !Number.isFinite(n)) return "";
  return n.toFixed(2);
}

export function priceUsd1CostHint(cost: number | null, marginPct: number | null, derived: number | null): string {
  if (cost == null || !(cost > 0)) return "Indica el costo USD para calcular Precio 1";
  if (marginPct == null || !Number.isFinite(marginPct)) return "Indica el % de ganancia sobre el costo";
  if (derived == null) return "No se pudo calcular Precio 1";
  const pct = marginPct.toLocaleString("es-VE", { maximumFractionDigits: 2 });
  return `Precio 1 = $ ${derived.toFixed(2)} (costo + ${pct}%)`;
}

export function priceUsd2AutoHint(fx: Pick<FxRate, "usd_to_ves" | "usdt_to_ves"> | null): string {
  const ratio = spreadRatioLabel(fx);
  if (!ratio) return "Falta tasa USDT o BCV";
  return `Precio 1 x ${ratio} (USDT/BCV)`;
}

export function priceVesAutoHint(fx: Pick<FxRate, "usd_to_ves"> | null): string {
  const bcv = Number(fx?.usd_to_ves);
  if (!(bcv > 0)) return "Falta tasa USD BCV";
  const rate = bcv.toLocaleString("es-VE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  });
  return `Precio 2 x ${rate} (USD BCV)`;
}

/** USD → Precio 1. Bs → Precio 3. */
export function unitPriceForQuote(product: Product, currency: CurrencyCode): number | null {
  if (currency === "VES") {
    const n = Number(product.price_ves);
    return Number.isFinite(n) && n >= 0 ? n : null;
  }
  const n = Number(product.price_usd);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}
