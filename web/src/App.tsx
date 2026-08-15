import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./auth/AuthContext";
import { RequireAuth } from "./auth/RequireAuth";
import { RequireRole } from "./auth/RequireRole";
import { RoleHomeRedirect } from "./auth/RoleHomeRedirect";
import { SellerShell } from "./layout/SellerShell";
import { SupervisorShell } from "./layout/SupervisorShell";
import { AccountPage } from "./pages/AccountPage";
import { AlertsInboxPage } from "./pages/AlertsInboxPage";
import { BanksPage } from "./pages/BanksPage";
import { CatalogVisibilityPage } from "./pages/CatalogVisibilityPage";
import { ClientAssignmentsPage } from "./pages/ClientAssignmentsPage";
import { ClientsPage } from "./pages/ClientsPage";
import { FinanceHubPage } from "./pages/FinanceHubPage";
import { FxRatePage } from "./pages/FxRatePage";
import { HomePage } from "./pages/HomePage";
import { InventoryPage } from "./pages/InventoryPage";
import { LoginPage } from "./pages/LoginPage";
import { PayablesPage } from "./pages/PayablesPage";
import { PayAccountsPage } from "./pages/PayAccountsPage";
import { ReceivablesPage } from "./pages/ReceivablesPage";
import { RouteDayPage } from "./pages/RouteDayPage";
import { SalesPage } from "./pages/SalesPage";
import { SellerDashboardPage } from "./pages/SellerDashboardPage";
import { SellerRouteMapPage } from "./pages/SellerRouteMapPage";
import { SellersPage } from "./pages/SellersPage";
import { SupervisorHomePage } from "./pages/SupervisorHomePage";
import { SupervisorStockPage } from "./pages/SupervisorStockPage";
import { SuppliersPage } from "./pages/SuppliersPage";
import { TeamMapPage } from "./pages/TeamMapPage";
import { TeamVisitsPage } from "./pages/TeamVisitsPage";
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
            <Route path="clientes" element={<ClientsPage />} />
            <Route path="ruta" element={<SellerRouteMapPage />} />
            <Route path="cobro" element={<PayAccountsPage />} />
            <Route path="avisos" element={<AlertsInboxPage />} />
            <Route path="desempeno" element={<SellerDashboardPage />} />
            <Route
              path="perfil"
              element={<AccountPage title="Perfil" blurb="Tu ficha y datos de cuenta." />}
            />
            <Route
              path="ajustes"
              element={<AccountPage title="Ajustes" blurb="Opciones de la app y sesión." />}
            />
            <Route
              path="preferencias"
              element={
                <AccountPage title="Preferencias" blurb="Idioma, notificaciones y preferencias de campo." />
              }
            />
            <Route path="resumen" element={<Navigate to="/app/desempeno" replace />} />
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
            <Route path="visitas" element={<TeamVisitsPage />} />
            <Route path="ventas" element={<SalesPage teamView />} />
            <Route path="vendedores" element={<SellersPage />} />
            <Route path="alertas" element={<AlertsInboxPage />} />
            <Route path="clientes" element={<ClientAssignmentsPage />} />
            <Route path="proveedores" element={<SuppliersPage />} />
            <Route path="catalogo" element={<CatalogVisibilityPage />} />
            <Route path="inventario" element={<SupervisorStockPage />} />
            <Route path="finanzas" element={<FinanceHubPage />} />
            <Route path="cobranza" element={<ReceivablesPage />} />
            <Route path="bancos" element={<BanksPage />} />
            <Route path="por-pagar" element={<PayablesPage />} />
            <Route path="fx" element={<FxRatePage />} />
            <Route path="mapa" element={<TeamMapPage />} />
            <Route
              path="perfil"
              element={<AccountPage title="Perfil" blurb="Tu ficha y datos de cuenta." />}
            />
            <Route
              path="ajustes"
              element={<AccountPage title="Ajustes" blurb="Opciones de la app y sesión." />}
            />
            <Route
              path="preferencias"
              element={
                <AccountPage title="Preferencias" blurb="Idioma, notificaciones y preferencias." />
              }
            />
          </Route>

          <Route path="/clientes" element={<Navigate to="/app/clientes" replace />} />
          <Route path="*" element={<RoleHomeRedirect />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
