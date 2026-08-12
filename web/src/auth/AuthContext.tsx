import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { fetchMe, loginRequest } from "../lib/api";
import { clearToken, getToken, setToken } from "../lib/authStorage";
import type { User } from "../lib/types";

type AuthState = {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
};

const AuthContext = createContext<AuthState | null>(null);

/**
 * AuthProvider: "caja" de React que guarda el usuario logueado
 * y lo comparte con cualquier página hija (sin pasar props a mano).
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      setLoading(false);
      return;
    }

    fetchMe()
      .then(async (me) => {
        setUser(me);
        try {
          const { refreshCatalogCache } = await import("../lib/offlineQueue");
          await refreshCatalogCache();
        } catch {
          /* cache best-effort */
        }
      })
      .catch(() => {
        clearToken();
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const { access_token } = await loginRequest(email, password);
    setToken(access_token);
    const me = await fetchMe();
    setUser(me);
    try {
      const { refreshCatalogCache } = await import("../lib/offlineQueue");
      await refreshCatalogCache();
    } catch {
      /* cache best-effort */
    }
  }, []);

  const logout = useCallback(() => {
    clearToken();
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, loading, login, logout }),
    [user, loading, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth debe usarse dentro de <AuthProvider>");
  }
  return ctx;
}
