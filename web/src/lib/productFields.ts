import type { Product } from "./types";
import { todayISO } from "./caracasTime";

export const PRODUCT_CATEGORIES = [
  "Bebidas",
  "Lácteos",
  "Abarrotes",
  "Snacks",
  "Limpieza",
  "General",
] as const;

export type ProductFormState = {
  sku: string;
  name: string;
  brand: string;
  category: string;
  presentation: string;
  barcode: string;
  unit: string;
  pack_units: string;
  price_usd: string;
  price_usd_2: string;
  price_ves: string;
  price_usd_auto: boolean;
  price_usd_margin_pct: string;
  price_usd_2_auto: boolean;
  price_ves_auto: boolean;
  cost_usd: string;
  min_stock: string;
  stock: string;
  lot: string;
  expires_on: string;
  notes: string;
  image_url: string | null;
};

export const emptyProductForm: ProductFormState = {
  sku: "",
  name: "",
  brand: "",
  category: "General",
  presentation: "",
  barcode: "",
  unit: "unidad",
  pack_units: "",
  price_usd: "",
  price_usd_2: "",
  price_ves: "",
  price_usd_auto: false,
  price_usd_margin_pct: "",
  price_usd_2_auto: true,
  price_ves_auto: true,
  cost_usd: "",
  min_stock: "40",
  stock: "0",
  lot: "",
  expires_on: "",
  notes: "",
  image_url: null,
};

function asText(value?: string | null): string {
  return value ?? "";
}

export function productToForm(product: Product): ProductFormState {
  return {
    sku: product.sku,
    name: product.name,
    brand: asText(product.brand),
    category: product.category || "General",
    presentation: asText(product.presentation),
    barcode: asText(product.barcode),
    unit: product.unit || "unidad",
    pack_units: product.pack_units != null ? String(product.pack_units) : "",
    price_usd: product.price_usd,
    price_usd_2: product.price_usd_2 ?? "",
    price_ves: product.price_ves ?? "",
    price_usd_auto: product.price_usd_auto === true,
    price_usd_margin_pct: product.price_usd_margin_pct ?? "",
    price_usd_2_auto: product.price_usd_2_auto !== false,
    price_ves_auto: product.price_ves_auto !== false,
    cost_usd: product.cost_usd ?? "",
    min_stock: String(product.min_stock ?? 40),
    stock: String(product.stock),
    lot: asText(product.lot),
    expires_on: (product.expires_on ?? "").slice(0, 10),
    notes: asText(product.notes),
    image_url: product.image_url ?? null,
  };
}

function optionalText(value: string): string | null {
  const text = value.trim();
  return text ? text : null;
}

function optionalNumber(value: string): number | null {
  const text = value.trim();
  if (!text) return null;
  const n = Number(text);
  return Number.isFinite(n) ? n : null;
}

export type ProductPayload = {
  sku?: string;
  name: string;
  unit: string;
  price_usd: number;
  price_usd_2: number | null;
  price_ves: number | null;
  price_usd_auto: boolean;
  price_usd_margin_pct: number | null;
  price_usd_2_auto: boolean;
  price_ves_auto: boolean;
  stock?: number;
  image_url: string | null;
  brand: string | null;
  category: string | null;
  presentation: string | null;
  barcode: string | null;
  cost_usd: number | null;
  pack_units: number | null;
  min_stock: number;
  lot: string | null;
  expires_on: string | null;
  notes: string | null;
};

export function parseProductForm(form: ProductFormState): { error: string } | { error: null; data: ProductPayload } {
  const name = form.name.trim();
  const sku = form.sku.trim().toUpperCase();
  const price = Number(form.price_usd);
  const price2 = optionalNumber(form.price_usd_2);
  const price3 = optionalNumber(form.price_ves);
  const cost = optionalNumber(form.cost_usd);
  const marginPct = optionalNumber(form.price_usd_margin_pct);
  const minStock = Number(form.min_stock.trim() || "40");
  const packUnits = optionalNumber(form.pack_units);
  if (!name) return { error: "El nombre es obligatorio" };
  if (form.price_usd_auto) {
    if (cost == null || !(cost > 0)) return { error: "Indica el costo USD para calcular Precio 1 por margen" };
    if (marginPct == null || marginPct < 0) return { error: "Indica el % de ganancia sobre el costo" };
  } else if (!Number.isFinite(price) || price < 0) {
    return { error: "Precio 1 inválido" };
  }
  if (price2 != null && price2 < 0) return { error: "Precio 2 inválido" };
  if (price3 != null && price3 < 0) return { error: "Precio 3 (Bs) inválido" };
  if (cost != null && cost < 0) return { error: "Costo inválido" };
  if (!Number.isFinite(minStock) || minStock < 0) return { error: "Stock mínimo inválido" };
  if (packUnits != null && packUnits < 1) return { error: "Unidades por empaque debe ser al menos 1" };
  return {
    error: null,
    data: {
      sku,
      name,
      unit: form.unit.trim() || "unidad",
      price_usd: Number.isFinite(price) && price >= 0 ? price : 0,
      price_usd_2: price2,
      price_ves: price3,
      price_usd_auto: form.price_usd_auto,
      price_usd_margin_pct: form.price_usd_auto ? marginPct : null,
      price_usd_2_auto: form.price_usd_2_auto,
      price_ves_auto: form.price_ves_auto,
      image_url: form.image_url,
      brand: optionalText(form.brand),
      category: optionalText(form.category),
      presentation: optionalText(form.presentation),
      barcode: optionalText(form.barcode),
      cost_usd: cost,
      pack_units: packUnits,
      min_stock: minStock,
      lot: optionalText(form.lot),
      expires_on: optionalText(form.expires_on),
      notes: optionalText(form.notes),
    },
  };
}

export function productSearchHay(product: Product): string {
  return [
    product.name,
    product.sku,
    product.brand,
    product.category,
    product.presentation,
    product.barcode,
    product.lot,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

/** % de ganancia sobre el costo: $1.50 con costo $1 → 50. */
export function productMarkupPct(price: number, cost: number | null): number | null {
  if (cost == null || !(cost > 0) || !Number.isFinite(price) || price < 0) return null;
  return Math.round((price / cost - 1) * 10000) / 100;
}

export type ExpiryTone = "ok" | "warn" | "bad";

export function productExpiry(expiresOn?: string | null): { text: string; tone: ExpiryTone } | null {
  if (!expiresOn) return null;
  const day = expiresOn.slice(0, 10);
  const today = todayISO();
  if (day < today) return { text: `Vencido ${day}`, tone: "bad" };
  const ms = Date.parse(`${day}T12:00:00`) - Date.parse(`${today}T12:00:00`);
  const days = Math.round(ms / 86_400_000);
  if (days <= 30) return { text: `Vence ${day}`, tone: "warn" };
  return { text: `Vence ${day}`, tone: "ok" };
}
