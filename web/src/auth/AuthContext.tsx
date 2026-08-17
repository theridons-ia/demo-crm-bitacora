import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { ApiError, fetchMe, isNetworkError, loginRequest } from "../lib/api";
import {
  clearSession,
  getCachedUser,
  getToken,
  setCachedUser,
  setToken,
} from "../lib/authStorage";
import type { User } from "../lib/types";

type AuthState = {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
};

const AuthContext = createContext<AuthState | null>(null);

function bootAuth(): { user: User | null; loading: boolean } {
  const token = getToken();
  if (!token) return { user: null, loading: false };
  const cached = getCachedUser();
  return { user: cached, loading: !cached };
}

/**
 * AuthProvider: "caja" de React que guarda el usuario logueado
 * y lo comparte con cualquier página hija (sin pasar props a mano).
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const boot = bootAuth();
  const [user, setUser] = useState<User | null>(boot.user);
  const [loading, setLoading] = useState(boot.loading);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      setLoading(false);
      return;
    }

    fetchMe()
      .then(async (me) => {
        setCachedUser(me);
        setUser(me);
        try {
          const { refreshCatalogCache } = await import("../lib/offlineQueue");
          await refreshCatalogCache();
        } catch {
          /* cache best-effort */
        }
      })
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) {
          setUser(null);
          return;
        }
        if (isNetworkError(err) || err instanceof ApiError) {
          const cached = getCachedUser();
          if (cached) {
            setUser(cached);
            return;
          }
        }
        if (!getCachedUser()) {
          clearSession();
          setUser(null);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const { access_token } = await loginRequest(email, password);
    setToken(access_token);
    const me = await fetchMe();
    setCachedUser(me);
    setUser(me);
    try {
      const { refreshCatalogCache } = await import("../lib/offlineQueue");
      await refreshCatalogCache();
    } catch {
      /* cache best-effort */
    }
  }, []);

  const logout = useCallback(() => {
    clearSession();
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
