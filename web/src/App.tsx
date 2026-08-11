import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./auth/AuthContext";
import { RequireAuth } from "./auth/RequireAuth";
import { ClientsPage } from "./pages/ClientsPage";
import { LoginPage } from "./pages/LoginPage";

/**
 * App: define las rutas (URLs) de la SPA.
 * /login → público
 * /clientes → solo con JWT válido
 */
export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/clientes"
            element={
              <RequireAuth>
                <ClientsPage />
              </RequireAuth>
            }
          />
          <Route path="/" element={<Navigate to="/clientes" replace />} />
          <Route path="*" element={<Navigate to="/clientes" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
