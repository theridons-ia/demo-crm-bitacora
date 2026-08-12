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

export function fetchClients(): Promise<Client[]> {
  return request<Client[]>("/api/clients");
}

export type ClientCreateInput = {
  name: string;
  rif?: string | null;
  ci?: string | null;
  state?: string | null;
  address?: string | null;
  phone?: string | null;
  notes?: string | null;
};

export function createClient(payload: ClientCreateInput): Promise<Client> {
  return request<Client>("/api/clients", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export function fetchVisits(): Promise<Visit[]> {
  return request<Visit[]>("/api/visits");
}

export type VisitCreateInput = {
  client_id: number;
  status?: VisitStatus;
  description?: string | null;
  scheduled_date?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  gps_accuracy_m?: number | null;
  gps_offline?: boolean;
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
};

export function startVisit(visitId: number, payload: VisitStartInput = {}): Promise<Visit> {
  return request<Visit>(`/api/visits/${visitId}/start`, {
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
    notes?: string | null;
    items: { product_id: number; quantity: number }[];
  } | null;
};

export function closeVisit(visitId: number, payload: VisitCloseInput): Promise<Visit> {
  return request<Visit>(`/api/visits/${visitId}/close`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export function fetchProducts(): Promise<Product[]> {
  return request<Product[]>("/api/products");
}

export function fetchSales(): Promise<Sale[]> {
  return request<Sale[]>("/api/sales");
}

export type SaleCreateInput = {
  client_id: number;
  origin: Exclude<SaleOrigin, "visita">;
  currency?: CurrencyCode;
  payment_method?: PaymentMethod;
  is_credit?: boolean;
  notes?: string | null;
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
