import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./auth/AuthContext";
import { RequireAuth } from "./auth/RequireAuth";
import { SellerShell } from "./layout/SellerShell";
import { HomePage } from "./pages/HomePage";
import { InventoryPage } from "./pages/InventoryPage";
import { LoginPage } from "./pages/LoginPage";
import { PlaceholderPage } from "./pages/PlaceholderPage";
import { VisitsPage } from "./pages/VisitsPage";

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/app"
            element={
              <RequireAuth>
                <SellerShell />
              </RequireAuth>
            }
          >
            <Route index element={<Navigate to="inicio" replace />} />
            <Route path="inicio" element={<HomePage />} />
            <Route path="visitas" element={<VisitsPage />} />
            <Route
              path="ventas"
              element={
                <PlaceholderPage
                  title="Ventas"
                  nextSf="SF-1.7 / SF-1.8"
                  blurb="Órdenes ligadas a visita o sin visita (mostrador/online)."
                />
              }
            />
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
          <Route path="/" element={<Navigate to="/app/inicio" replace />} />
          <Route path="/clientes" element={<Navigate to="/app/inicio" replace />} />
          <Route path="*" element={<Navigate to="/app/inicio" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
