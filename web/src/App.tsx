import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./auth/AuthContext";
import { RequireAuth } from "./auth/RequireAuth";
import { RequireRole } from "./auth/RequireRole";
import { RoleHomeRedirect } from "./auth/RoleHomeRedirect";
import { SellerShell } from "./layout/SellerShell";
import { SupervisorShell } from "./layout/SupervisorShell";
import { HomePage } from "./pages/HomePage";
import { InventoryPage } from "./pages/InventoryPage";
import { LoginPage } from "./pages/LoginPage";
import { PlaceholderPage } from "./pages/PlaceholderPage";
import { SalesPage } from "./pages/SalesPage";
import { SupervisorHomePage } from "./pages/SupervisorHomePage";
import { RouteDayPage } from "./pages/RouteDayPage";
import { VisitsPage } from "./pages/VisitsPage";

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={<RoleHomeRedirect />} />

          <Route
            path="/app"
            element={
              <RequireAuth>
                <RequireRole roles={["vendedor"]}>
                  <SellerShell />
                </RequireRole>
              </RequireAuth>
            }
          >
            <Route index element={<Navigate to="inicio" replace />} />
            <Route path="inicio" element={<HomePage />} />
            <Route path="visitas" element={<VisitsPage />} />
            <Route path="ventas" element={<SalesPage />} />
            <Route path="inventario" element={<InventoryPage />} />
            <Route
              path="resumen"
              element={
                <PlaceholderPage
                  title="Resumen"
                  nextSf="SF-1.x"
                  blurb="KPIs del día: visitas, ventas y evidencias."
                />
              }
            />
          </Route>

          <Route
            path="/sup"
            element={
              <RequireAuth>
                <RequireRole roles={["supervisor", "admin"]}>
                  <SupervisorShell />
                </RequireRole>
              </RequireAuth>
            }
          >
            <Route index element={<Navigate to="hoy" replace />} />
            <Route path="hoy" element={<SupervisorHomePage />} />
            <Route path="ruta" element={<RouteDayPage />} />
            <Route
              path="alertas"
              element={
                <PlaceholderPage
                  title="Alertas"
                  nextSf="SF-2.3"
                  blurb="Inbox de alertas GPS / foto para el equipo."
                />
              }
            />
            <Route
              path="catalogo"
              element={
                <PlaceholderPage
                  title="Catálogo por vendedor"
                  nextSf="SF-2.4"
                  blurb="Qué productos ve y puede vender cada vendedor."
                />
              }
            />
            <Route
              path="mapa"
              element={
                <PlaceholderPage
                  title="Mapa del equipo"
                  nextSf="SF-2.5"
                  blurb="Visitas del día en un mapa compartido."
                />
              }
            />
          </Route>

          <Route path="/clientes" element={<Navigate to="/app/inicio" replace />} />
          <Route path="*" element={<RoleHomeRedirect />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
