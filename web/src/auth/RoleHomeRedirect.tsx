import { Navigate } from "react-router-dom";
import { useAuth } from "./AuthContext";

/** Tras login: vendedor → /app; supervisor/admin → /sup. */
export function RoleHomeRedirect() {
  const { user, loading } = useAuth();

  if (!user && loading) {
    return (
      <div className="app-shell">
        <p className="muted">Cargando…</p>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (user.role === "vendedor") {
    return <Navigate to="/app/inicio" replace />;
  }

  return <Navigate to="/sup/hoy" replace />;
}
