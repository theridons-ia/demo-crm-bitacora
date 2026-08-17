import type { User } from "./types";

const TOKEN_KEY = "bitacora.access_token";
const USER_KEY = "bitacora.user";

/** Guardamos el JWT en localStorage para sobrevivir un refresh de la página. */
export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

function isUser(value: unknown): value is User {
  if (!value || typeof value !== "object") return false;
  const row = value as Partial<User>;
  return (
    typeof row.id === "number" &&
    typeof row.email === "string" &&
    typeof row.full_name === "string" &&
    typeof row.role === "string"
  );
}

/** Último usuario conocido: sirve si `/me` falla por red, no por 401. */
export function getCachedUser(): User | null {
  try {
    const raw = localStorage.getItem(USER_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isUser(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function setCachedUser(user: User): void {
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearCachedUser(): void {
  localStorage.removeItem(USER_KEY);
}

export function clearSession(): void {
  clearToken();
  clearCachedUser();
}
