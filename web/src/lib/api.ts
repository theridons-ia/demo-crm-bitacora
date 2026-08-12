import { clearToken, getToken } from "./authStorage";
import type { Client, SaleResult, TokenResponse, User, Visit, VisitStatus } from "./types";

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
};

export function createVisit(payload: VisitCreateInput): Promise<Visit> {
  return request<Visit>("/api/visits", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export function startVisit(visitId: number): Promise<Visit> {
  return request<Visit>(`/api/visits/${visitId}/start`, { method: "POST" });
}

export type VisitCloseInput = {
  result: SaleResult;
  description?: string | null;
};

export function closeVisit(visitId: number, payload: VisitCloseInput): Promise<Visit> {
  return request<Visit>(`/api/visits/${visitId}/close`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}
