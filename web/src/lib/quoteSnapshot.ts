import type { Client, CurrencyCode, Product, Sale } from "../lib/types";
import type { QuoteDocLine, QuoteDocumentData } from "../components/QuoteDocument";
import type { QuoteLine } from "../components/SaleQuoter";
import { buildQuoteLines, DEFAULT_QUOTE_ISSUER } from "../components/QuoteDocument";
import { saleOrderCode } from "./saleLabels";

/** Snapshot serializable guardado en Sale.quote_snapshot. */
export type QuoteSnapshot = {
  code: string;
  issuedAt: string;
  sellerName: string;
  clientName: string;
  clientRif: string | null;
  clientAddress: string | null;
  currency: CurrencyCode;
  fxRate: number | null;
  notes: string | null;
  isCredit: boolean;
  applyIva?: boolean;
  issuer?: {
    companyName?: string | null;
    rif?: string | null;
    slogan?: string | null;
    address?: string | null;
  };
  lines: QuoteDocLine[];
  confirmed?: boolean;
};

export function serializeQuoteSnapshot(data: QuoteDocumentData): string {
  const client = data.client;
  const snap: QuoteSnapshot = {
    code: data.code,
    issuedAt: data.issuedAt.toISOString(),
    sellerName: data.sellerName,
    clientName: client?.name ?? data.clientFallback,
    clientRif: client?.rif ?? (client?.ci ? `CI ${client.ci}` : null),
    clientAddress: [client?.address, client?.state].filter(Boolean).join(" · ") || null,
    currency: data.currency,
    fxRate: data.fxRate,
    notes: data.notes ?? null,
    isCredit: Boolean(data.isCredit),
    applyIva: Boolean(data.applyIva),
    issuer: data.issuer ?? DEFAULT_QUOTE_ISSUER,
    lines: data.lines,
  };
  return JSON.stringify(snap);
}

export function parseQuoteSnapshot(raw: string | null | undefined): QuoteSnapshot | null {
  if (!raw?.trim()) return null;
  try {
    const data = JSON.parse(raw) as QuoteSnapshot;
    if (!data || !Array.isArray(data.lines)) return null;
    return data;
  } catch {
    return null;
  }
}

export function snapshotToQuoteDocumentData(snap: QuoteSnapshot): QuoteDocumentData {
  const client: Client | null = {
    id: 0,
    name: snap.clientName,
    rif: snap.clientRif?.startsWith("CI ") ? null : snap.clientRif,
    ci: snap.clientRif?.startsWith("CI ") ? snap.clientRif.replace(/^CI\s+/, "") : null,
    state: null,
    address: snap.clientAddress,
    phone: null,
    notes: null,
    latitude: null,
    longitude: null,
    is_active: true,
  };
  return {
    code: snap.code,
    issuedAt: new Date(snap.issuedAt),
    sellerName: snap.sellerName,
    client,
    clientFallback: snap.clientName,
    currency: snap.currency,
    fxRate: snap.fxRate,
    lines: snap.lines,
    notes: snap.notes,
    isCredit: snap.isCredit,
    applyIva: Boolean(snap.applyIva),
    issuer: snap.issuer ?? null,
  };
}

/** Reconstruye cotización si no hay snapshot (OV antiguas). */
export function buildQuoteDataFromSale(
  sale: Sale,
  products: Product[],
  sellerName: string,
): QuoteDocumentData {
  const byId = new Map(products.map((p) => [p.id, p]));
  const lines: QuoteDocLine[] = (sale.items ?? []).map((item) => {
    const p = byId.get(item.product_id);
    const unitUsd = Number(item.unit_price);
    return {
      sku: p?.sku ?? `#${item.product_id}`,
      name: p?.name ?? `Producto #${item.product_id}`,
      quantity: item.quantity,
      unitUsd,
      lineUsd: Number(item.line_total),
    };
  });
  return {
    code: saleOrderCode(sale),
    issuedAt: new Date(sale.created_at),
    sellerName,
    client: sale.client,
    clientFallback: sale.client?.name ?? `Cliente #${sale.client_id}`,
    currency: sale.currency,
    fxRate: sale.fx_rate_usd_ves != null ? Number(sale.fx_rate_usd_ves) : null,
    lines,
    notes: sale.notes,
    isCredit: sale.is_credit,
    applyIva: Boolean(sale.apply_iva),
  };
}

export function buildQuoteDataFromDraft(input: {
  code: string;
  issuedAt: Date;
  sellerName: string;
  client: Client | null;
  clientFallback: string;
  currency: CurrencyCode;
  fxRate: number | null;
  lines: QuoteLine[];
  products: Product[];
  notes?: string | null;
  isCredit?: boolean;
  applyIva?: boolean;
}): QuoteDocumentData {
  return {
    code: input.code,
    issuedAt: input.issuedAt,
    sellerName: input.sellerName,
    client: input.client,
    clientFallback: input.clientFallback,
    currency: input.currency,
    fxRate: input.fxRate,
    lines: buildQuoteLines(input.lines, input.products),
    notes: input.notes ?? null,
    isCredit: input.isCredit,
    applyIva: input.applyIva,
  };
}
