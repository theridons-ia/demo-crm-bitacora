const TOKEN_KEY = "bitacora.access_token";

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
