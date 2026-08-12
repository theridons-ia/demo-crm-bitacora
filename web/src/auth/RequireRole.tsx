import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import type { UserRole } from "../lib/types";
import { useAuth } from "./AuthContext";

type Props = {
  roles: UserRole[];
  children: ReactNode;
};

/** Si el rol no está permitido, redirige al home de su rol. */
export function RequireRole({ roles, children }: Props) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="app-shell">
        <p className="muted">Cargando…</p>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (!roles.includes(user.role)) {
    if (user.role === "vendedor") {
      return <Navigate to="/app/inicio" replace />;
    }
    return <Navigate to="/sup/hoy" replace />;
  }

  return <>{children}</>;
}
