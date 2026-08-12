import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./auth/AuthContext";
import { RequireAuth } from "./auth/RequireAuth";
import { RequireRole } from "./auth/RequireRole";
import { RoleHomeRedirect } from "./auth/RoleHomeRedirect";
import { SellerShell } from "./layout/SellerShell";
import { SupervisorShell } from "./layout/SupervisorShell";
import { AlertsInboxPage } from "./pages/AlertsInboxPage";
import { CatalogVisibilityPage } from "./pages/CatalogVisibilityPage";
import { HomePage } from "./pages/HomePage";
import { InventoryPage } from "./pages/InventoryPage";
import { LoginPage } from "./pages/LoginPage";
import { PlaceholderPage } from "./pages/PlaceholderPage";
import { ReceivablesPage } from "./pages/ReceivablesPage";
import { RouteDayPage } from "./pages/RouteDayPage";
import { SalesPage } from "./pages/SalesPage";
import { SupervisorHomePage } from "./pages/SupervisorHomePage";
import { SupervisorStockPage } from "./pages/SupervisorStockPage";
import { TeamMapPage } from "./pages/TeamMapPage";
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
            <Route path="alertas" element={<AlertsInboxPage />} />
            <Route path="catalogo" element={<CatalogVisibilityPage />} />
            <Route path="inventario" element={<SupervisorStockPage />} />
            <Route path="cobranza" element={<ReceivablesPage />} />
            <Route path="mapa" element={<TeamMapPage />} />
          </Route>

          <Route path="/clientes" element={<Navigate to="/app/inicio" replace />} />
          <Route path="*" element={<RoleHomeRedirect />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
