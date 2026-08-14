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
  const cost = optionalNumber(form.cost_usd);
  const minStock = Number(form.min_stock.trim() || "40");
  const packUnits = optionalNumber(form.pack_units);
  if (!name) return { error: "El nombre es obligatorio" };
  if (!Number.isFinite(price) || price < 0) return { error: "Precio inválido" };
  if (cost != null && cost < 0) return { error: "Costo inválido" };
  if (!Number.isFinite(minStock) || minStock < 0) return { error: "Stock mínimo inválido" };
  if (packUnits != null && packUnits < 1) return { error: "Unidades por empaque debe ser al menos 1" };
  return {
    error: null,
    data: {
      sku,
      name,
      unit: form.unit.trim() || "unidad",
      price_usd: price,
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

export function productMarginPct(price: number, cost: number | null): number | null {
  if (cost == null || !(price > 0)) return null;
  return Math.round(((price - cost) / price) * 100);
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
