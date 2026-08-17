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

/** Precio 1 = Precio 2 ÷ diferencial USDT/BCV */
export function derivePriceUsd1(price2: number, fx: Pick<FxRate, "usd_to_ves" | "usdt_to_ves"> | null): number | null {
  const spread = usdtBcvSpread(fx);
  if (spread == null || !(spread > 0) || !(price2 >= 0) || !Number.isFinite(price2)) return null;
  return Math.round((price2 / spread) * 100) / 100;
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

export function priceUsd1MarginHint(fx: Pick<FxRate, "usd_to_ves" | "usdt_to_ves"> | null): string {
  const ratio = spreadRatioLabel(fx);
  if (!ratio) return "Falta tasa USDT o BCV";
  return `Precio 2 ÷ ${ratio} (USDT/BCV)`;
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
