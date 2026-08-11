import { clearToken, getToken } from "./authStorage";
import type { Client, TokenResponse, User } from "./types";

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
      const data = (await response.json()) as { detail?: string };
      if (data.detail) detail = data.detail;
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
