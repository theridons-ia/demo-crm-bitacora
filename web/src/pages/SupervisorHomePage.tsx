import { Link } from "react-router-dom";
import { AlertTriangle, Map, Package, Route } from "lucide-react";
import { useAuth } from "../auth/AuthContext";

const LINKS = [
  {
    to: "/sup/ruta",
    title: "Ruta del día",
    blurb: "Asignar y desasignar visitas planificadas.",
    sf: "SF-2.2",
    icon: Route,
  },
  {
    to: "/sup/alertas",
    title: "Alertas GPS / foto",
    blurb: "Inbox de cierres lejos, sin GPS o solo foto.",
    sf: "SF-2.3",
    icon: AlertTriangle,
  },
  {
    to: "/sup/catalogo",
    title: "Visibilidad catálogo",
    blurb: "Qué productos ve cada vendedor.",
    sf: "SF-2.4",
    icon: Package,
  },
  {
    to: "/sup/mapa",
    title: "Mapa del equipo",
    blurb: "Visitas del día en un solo mapa.",
    sf: "SF-2.5",
    icon: Map,
  },
] as const;

/** Panel de entrada del supervisor — layout listo; módulos llegan en SF-2.2+. */
export function SupervisorHomePage() {
  const { user } = useAuth();

  return (
    <>
      <header className="page-header">
        <div>
          <p className="eyebrow">Supervisor</p>
          <h1>Hoy</h1>
          <p className="muted">
            Hola{user?.full_name ? `, ${user.full_name}` : ""}. Este es el escritorio del
            supervisor — sin barra inferior tipo app.
          </p>
        </div>
      </header>

      <section className="sup-home-grid" aria-label="Módulos próximos">
        {LINKS.map(({ to, title, blurb, sf, icon: Icon }) => (
          <Link key={to} to={to} className="sup-home-card">
            <span className="sup-home-icon" aria-hidden>
              <Icon size={20} strokeWidth={2} />
            </span>
            <div>
              <h2 className="sup-home-title">{title}</h2>
              <p className="muted small">{blurb}</p>
              <p className="sup-home-sf muted small">Pendiente · {sf}</p>
            </div>
          </Link>
        ))}
      </section>
    </>
  );
}
