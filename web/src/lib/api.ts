import { clearToken, getToken } from "./authStorage";
import type {
  Client,
  CurrencyCode,
  PaymentMethod,
  Product,
  Sale,
  SaleOrigin,
  SaleResult,
  TokenResponse,
  User,
  Visit,
  VisitAlert,
  VisitGpsPoint,
  VisitStatus,
} from "./types";

/**
 * Base del API.
 * En `npm run dev`, Vite reenvía `/api` → FastAPI :8090 (ver vite.config.ts).
 * Así el navegador llama rutas relativas y evitamos líos de CORS en local.
 */
const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "";

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  const token = getToken();
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(`${API_BASE}${path}`, { ...init, headers });

  if (response.status === 401) {
    clearToken();
  }

  if (!response.ok) {
    let detail = `Error HTTP ${response.status}`;
    try {
      const data = (await response.json()) as { detail?: unknown };
      if (typeof data.detail === "string") {
        detail = data.detail;
      } else if (Array.isArray(data.detail)) {
        detail = data.detail
          .map((item) => {
            if (item && typeof item === "object" && "msg" in item) {
              return String((item as { msg: string }).msg);
            }
            return JSON.stringify(item);
          })
          .join("; ");
      }
    } catch {
      /* cuerpo no JSON */
    }
    throw new ApiError(response.status, detail);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

/**
 * FastAPI usa OAuth2PasswordRequestForm:
 * hay que enviar form-urlencoded con campos `username` y `password`
 * (el "username" es nuestro email).
 */
export async function loginRequest(email: string, password: string): Promise<TokenResponse> {
  const body = new URLSearchParams();
  body.set("username", email);
  body.set("password", password);

  return request<TokenResponse>("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
}

export function fetchMe(): Promise<User> {
  return request<User>("/api/auth/me");
}

export function fetchSellers(): Promise<User[]> {
  return request<User[]>("/api/users/sellers");
}

export type SellerCreateInput = {
  email: string;
  full_name: string;
  password: string;
  route_name?: string | null;
  initials?: string | null;
};

export function createSeller(payload: SellerCreateInput): Promise<User> {
  return request<User>("/api/users", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...payload, role: "vendedor" }),
  });
}

export function fetchClients(params?: { seller_id?: number }): Promise<Client[]> {
  const q = new URLSearchParams();
  if (params?.seller_id != null) q.set("seller_id", String(params.seller_id));
  const qs = q.toString();
  return request<Client[]>(`/api/clients${qs ? `?${qs}` : ""}`);
}

export type ClientAssignments = {
  seller_id: number;
  client_ids: number[];
};

export function fetchClientAssignments(sellerId: number): Promise<ClientAssignments> {
  return request<ClientAssignments>(`/api/sellers/${sellerId}/client-assignments`);
}

export function updateClientAssignments(
  sellerId: number,
  client_ids: number[],
): Promise<ClientAssignments> {
  return request<ClientAssignments>(`/api/sellers/${sellerId}/client-assignments`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ client_ids }),
  });
}

export type ClientCreateInput = {
  name: string;
  rif?: string | null;
  ci?: string | null;
  state?: string | null;
  address?: string | null;
  phone?: string | null;
  notes?: string | null;
  latitude?: number | null;
  longitude?: number | null;
};

export function createClient(payload: ClientCreateInput): Promise<Client> {
  return request<Client>("/api/clients", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export function updateClient(clientId: number, payload: ClientCreateInput): Promise<Client> {
  return request<Client>(`/api/clients/${clientId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export function fetchVisits(params?: {
  scheduled_date?: string;
  day?: string;
  seller_id?: number;
  status?: VisitStatus;
}): Promise<Visit[]> {
  const q = new URLSearchParams();
  if (params?.scheduled_date) q.set("scheduled_date", params.scheduled_date);
  if (params?.day) q.set("day", params.day);
  if (params?.seller_id != null) q.set("seller_id", String(params.seller_id));
  if (params?.status) q.set("status", params.status);
  const qs = q.toString();
  return request<Visit[]>(`/api/visits${qs ? `?${qs}` : ""}`);
}

export type VisitAssignInput = {
  seller_id: number;
  client_id: number;
  scheduled_date: string;
  scheduled_time?: string | null;
  description?: string | null;
};

export function assignVisit(payload: VisitAssignInput): Promise<Visit> {
  return request<Visit>("/api/visits/assign", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export function unassignVisit(visitId: number): Promise<void> {
  return request<void>(`/api/visits/${visitId}`, { method: "DELETE" });
}

export type VisitCreateInput = {
  client_id: number;
  status?: VisitStatus;
  description?: string | null;
  scheduled_date?: string | null;
  scheduled_time?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  gps_accuracy_m?: number | null;
  gps_offline?: boolean;
  local_uuid?: string | null;
};

export function createVisit(payload: VisitCreateInput): Promise<Visit> {
  return request<Visit>("/api/visits", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export type VisitStartInput = {
  latitude?: number | null;
  longitude?: number | null;
  gps_accuracy_m?: number | null;
  gps_offline?: boolean;
  replace_start?: boolean;
};

export function startVisit(visitId: number, payload: VisitStartInput = {}): Promise<Visit> {
  return request<Visit>(`/api/visits/${visitId}/start`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

/** Fuerza guardar lat/lng actuales en la visita abierta. */
export function pinVisitGps(visitId: number, payload: VisitStartInput): Promise<Visit> {
  return request<Visit>(`/api/visits/${visitId}/gps`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export function cancelVisit(
  visitId: number,
  payload: { description?: string | null } = {},
): Promise<Visit> {
  return request<Visit>(`/api/visits/${visitId}/cancel`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export type VisitCloseInput = {
  result: SaleResult;
  description?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  gps_accuracy_m?: number | null;
  gps_offline?: boolean;
  gps_captured_at?: string | null;
  gps_skipped?: boolean;
  gps_skip_reason?: string | null;
  photo_evidence?: string | null;
  sale?: {
    origin?: "visita";
    currency?: CurrencyCode;
    payment_method?: PaymentMethod;
    is_credit?: boolean;
    bank_account_id?: number | null;
    payment_reference?: string | null;
    payment_evidence?: string | null;
    notes?: string | null;
    apply_iva?: boolean;
    items: { product_id: number; quantity: number }[];
    local_uuid?: string | null;
    created_offline?: boolean;
  } | null;
};

export function closeVisit(visitId: number, payload: VisitCloseInput): Promise<Visit> {
  return request<Visit>(`/api/visits/${visitId}/close`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export type VisitSaleInput = {
  origin?: "visita";
  currency?: CurrencyCode;
  payment_method?: PaymentMethod;
  is_credit?: boolean;
  bank_account_id?: number | null;
  payment_reference?: string | null;
  payment_evidence?: string | null;
  notes?: string | null;
  apply_iva?: boolean;
  quote_snapshot?: string | null;
  items: { product_id: number; quantity: number }[];
  local_uuid?: string | null;
  created_offline?: boolean;
};

/** OV en visita en_curso; la visita no se cierra. */
export function createVisitSale(visitId: number, payload: VisitSaleInput): Promise<Sale> {
  return request<Sale>(`/api/visits/${visitId}/sale`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ origin: "visita", ...payload }),
  });
}

export function fetchProducts(): Promise<Product[]> {
  return request<Product[]>("/api/products");
}

export type ProductCreateInput = {
  sku: string;
  name: string;
  unit?: string;
  price_usd?: number;
  stock?: number;
  image_url?: string | null;
  brand?: string | null;
  category?: string | null;
  presentation?: string | null;
  barcode?: string | null;
  cost_usd?: number | null;
  pack_units?: number | null;
  min_stock?: number;
  lot?: string | null;
  expires_on?: string | null;
  notes?: string | null;
};

export function createProduct(payload: ProductCreateInput): Promise<Product> {
  return request<Product>("/api/products", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export type ProductUpdateInput = {
  name?: string;
  unit?: string;
  price_usd?: number;
  image_url?: string | null;
  brand?: string | null;
  category?: string | null;
  presentation?: string | null;
  barcode?: string | null;
  cost_usd?: number | null;
  pack_units?: number | null;
  min_stock?: number;
  lot?: string | null;
  expires_on?: string | null;
  notes?: string | null;
  is_active?: boolean;
};

export function updateProduct(id: number, payload: ProductUpdateInput): Promise<Product> {
  return request<Product>(`/api/products/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export type CatalogVisibility = {
  seller_id: number;
  unrestricted: boolean;
  product_ids: number[];
};

export function fetchCatalogVisibility(sellerId: number): Promise<CatalogVisibility> {
  return request<CatalogVisibility>(`/api/sellers/${sellerId}/catalog-visibility`);
}

export function updateCatalogVisibility(
  sellerId: number,
  payload: { unrestricted: boolean; product_ids: number[] },
): Promise<CatalogVisibility> {
  return request<CatalogVisibility>(`/api/sellers/${sellerId}/catalog-visibility`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export function fetchSales(params?: { client_id?: number }): Promise<Sale[]> {
  const q = new URLSearchParams();
  if (params?.client_id != null) q.set("client_id", String(params.client_id));
  const qs = q.toString();
  return request<Sale[]>(`/api/sales${qs ? `?${qs}` : ""}`);
}

export type SaleCreateInput = {
  client_id: number;
  origin: Exclude<SaleOrigin, "visita">;
  currency?: CurrencyCode;
  payment_method?: PaymentMethod;
  is_credit?: boolean;
  bank_account_id?: number | null;
  payment_reference?: string | null;
  payment_evidence?: string | null;
  notes?: string | null;
  apply_iva?: boolean;
  quote_snapshot?: string | null;
  items: { product_id: number; quantity: number }[];
  local_uuid?: string | null;
  created_offline?: boolean;
};

export function createSale(payload: SaleCreateInput): Promise<Sale> {
  return request<Sale>("/api/sales", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export function fetchVisitGpsPoints(visitId: number): Promise<VisitGpsPoint[]> {
  return request<VisitGpsPoint[]>(`/api/visits/${visitId}/gps-points`);
}

export type GpsPointCreateInput = {
  latitude: number;
  longitude: number;
  accuracy_m?: number | null;
  captured_at?: string | null;
  source?: "start" | "watch" | "end";
};

export function postVisitGpsPoint(
  visitId: number,
  payload: GpsPointCreateInput,
): Promise<VisitGpsPoint> {
  return request<VisitGpsPoint>(`/api/visits/${visitId}/gps-points`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export type OfflineVisitSyncPayload = {
  local_uuid: string;
  client_id: number;
  description?: string | null;
  result: SaleResult;
  latitude?: number | null;
  longitude?: number | null;
  gps_accuracy_m?: number | null;
  gps_captured_at?: string | null;
  visited_at?: string | null;
  gps_skipped?: boolean;
  gps_skip_reason?: string | null;
  photo_evidence?: string | null;
  sale?: {
    origin?: SaleOrigin;
    currency?: CurrencyCode;
    payment_method?: PaymentMethod;
    is_credit?: boolean;
    notes?: string | null;
    apply_iva?: boolean;
    items: { product_id: number; quantity: number }[];
    local_uuid?: string | null;
    created_offline?: boolean;
  } | null;
};

export type SyncOfflineResponse = {
  accepted: number;
  visit_ids: number[];
  message: string;
};

export function syncOfflineVisits(payload: {
  visits: OfflineVisitSyncPayload[] | Record<string, unknown>[];
}): Promise<SyncOfflineResponse> {
  return request<SyncOfflineResponse>("/api/sync/offline-visits", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export function fetchAlerts(params?: { unacked_only?: boolean }): Promise<VisitAlert[]> {
  const q = new URLSearchParams();
  if (params?.unacked_only) q.set("unacked_only", "true");
  const qs = q.toString();
  return request<VisitAlert[]>(`/api/alerts${qs ? `?${qs}` : ""}`);
}

export function acknowledgeAlert(alertId: number): Promise<VisitAlert> {
  return request<VisitAlert>(`/api/alerts/${alertId}/ack`, { method: "POST" });
}

export type StockMovementKind = "purchase" | "adjustment";

export type StockMovement = {
  id: number;
  product_id: number;
  supplier_id: number | null;
  kind: StockMovementKind;
  quantity: number;
  unit_cost_usd: string | null;
  notes: string | null;
  created_by_id: number;
  created_at: string;
  product_name: string | null;
  supplier_name: string | null;
  created_by_name: string | null;
  stock_after: number | null;
};

export type StockMovementInput = {
  product_id: number;
  kind: StockMovementKind;
  quantity: number;
  supplier_id?: number | null;
  unit_cost_usd?: number | null;
  notes?: string | null;
};

export function fetchStockMovements(): Promise<StockMovement[]> {
  return request<StockMovement[]>("/api/stock-movements");
}

export function createStockMovement(payload: StockMovementInput): Promise<StockMovement> {
  return request<StockMovement>("/api/stock-movements", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export type Receivable = {
  sale_id: number;
  client_id: number;
  client_name: string | null;
  seller_id: number;
  seller_name: string | null;
  currency: string;
  total_amount: string;
  paid_amount: string;
  balance: string;
  created_at: string;
  notes: string | null;
  payments: {
    id: number;
    sale_id: number;
    amount: string;
    currency: string;
    payment_method: string;
    notes: string | null;
    received_by_id: number;
    created_at: string;
    received_by_name: string | null;
  }[];
};

export function fetchReceivables(params?: { open_only?: boolean }): Promise<Receivable[]> {
  const q = new URLSearchParams();
  if (params?.open_only === false) q.set("open_only", "false");
  const qs = q.toString();
  return request<Receivable[]>(`/api/receivables${qs ? `?${qs}` : ""}`);
}

export function registerReceivablePayment(
  saleId: number,
  payload: {
    amount: number;
    currency?: string;
    payment_method?: string;
    bank_account_id?: number | null;
    payment_reference?: string | null;
    payment_evidence?: string | null;
    notes?: string | null;
  },
): Promise<Receivable> {
  return request<Receivable>(`/api/receivables/${saleId}/payments`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export type FxRate = {
  id: number;
  rate_date: string;
  usd_to_ves: string;
  notes: string | null;
  created_by_id: number | null;
  created_at: string;
  updated_at: string;
  created_by_name: string | null;
};

export function fetchFxToday(onDate?: string): Promise<FxRate> {
  const q = onDate ? `?on_date=${onDate}` : "";
  return request<FxRate>(`/api/fx/today${q}`);
}

export function fetchFxRates(): Promise<FxRate[]> {
  return request<FxRate[]>("/api/fx");
}

export function upsertFxRate(payload: {
  rate_date: string;
  usd_to_ves: number;
  notes?: string | null;
}): Promise<FxRate> {
  return request<FxRate>("/api/fx", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export type Supplier = {
  id: number;
  name: string;
  rif: string | null;
  ci: string | null;
  phone: string | null;
  email: string | null;
  notes: string | null;
  is_active: boolean;
};

export function fetchSuppliers(): Promise<Supplier[]> {
  return request<Supplier[]>("/api/suppliers");
}

export type SupplierCreateInput = {
  name: string;
  rif?: string | null;
  ci?: string | null;
  phone?: string | null;
  email?: string | null;
  notes?: string | null;
};

export function createSupplier(payload: SupplierCreateInput): Promise<Supplier> {
  return request<Supplier>("/api/suppliers", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export function fetchBankAccounts(params?: {
  active_only?: boolean;
  currency?: CurrencyCode;
}): Promise<import("./types").BankAccount[]> {
  const q = new URLSearchParams();
  if (params?.active_only) q.set("active_only", "true");
  if (params?.currency) q.set("currency", params.currency);
  const qs = q.toString();
  return request(`/api/banks${qs ? `?${qs}` : ""}`);
}

export function createBankAccount(payload: {
  name: string;
  bank_name?: string | null;
  account_type?: import("./types").BankAccountType;
  currency?: CurrencyCode;
  pay_hint?: string | null;
  is_active?: boolean;
  sort_order?: number;
}): Promise<import("./types").BankAccount> {
  return request("/api/banks", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export function updateBankAccount(
  id: number,
  payload: Partial<{
    name: string;
    bank_name: string | null;
    account_type: import("./types").BankAccountType;
    currency: CurrencyCode;
    pay_hint: string | null;
    is_active: boolean;
    sort_order: number;
  }>,
): Promise<import("./types").BankAccount> {
  return request(`/api/banks/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export function fetchBankMovements(params?: {
  bank_account_id?: number;
  limit?: number;
}): Promise<import("./types").BankMovement[]> {
  const q = new URLSearchParams();
  if (params?.bank_account_id != null) q.set("bank_account_id", String(params.bank_account_id));
  if (params?.limit != null) q.set("limit", String(params.limit));
  const qs = q.toString();
  return request(`/api/banks/movements${qs ? `?${qs}` : ""}`);
}

export function fetchPayables(params?: { open_only?: boolean }): Promise<import("./types").PayableInvoice[]> {
  const q = new URLSearchParams();
  if (params?.open_only === false) q.set("open_only", "false");
  const qs = q.toString();
  return request(`/api/payables${qs ? `?${qs}` : ""}`);
}
