import type { ReactNode } from "react";
import { MapPin, Package, Route, Users } from "lucide-react";
import { Button } from "../components/Button";
import { TextField } from "../components/TextField";

/**
 * Pantalla placeholder SF-0.1: valida tokens, botones e iconos Lucide.
 * En SF-0.2 se sustituye por login real contra el API.
 */
export function HomePage() {
  return (
    <div className="app-shell">
      <header style={{ marginBottom: "1.5rem" }}>
        <p
          style={{
            margin: 0,
            fontSize: "0.8rem",
            fontWeight: 700,
            letterSpacing: "0.04em",
            textTransform: "uppercase",
            color: "var(--muted-foreground)",
          }}
        >
          Bitácora Campo
        </p>
        <h1 style={{ margin: "0.35rem 0 0", fontSize: "1.75rem", lineHeight: 1.2 }}>
          Scaffold web listo
        </h1>
        <p style={{ margin: "0.6rem 0 0", color: "var(--muted-foreground)" }}>
          Sub-fase <strong>SF-0.1</strong>: design system + React. El login al API llega en{" "}
          <strong>SF-0.2</strong>.
        </p>
      </header>

      <section className="card" style={{ marginBottom: "1rem" }}>
        <h2 style={{ margin: "0 0 0.75rem", fontSize: "1.05rem" }}>Componentes base</h2>
        <div style={{ display: "grid", gap: "0.75rem" }}>
          <TextField id="demo-email" label="Email (demo visual)" placeholder="marina@bitacora.local" disabled />
          <Button variant="primary" block>
            Primario
          </Button>
          <Button variant="accent" block>
            Acento
          </Button>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
            <Button variant="secondary">Secundario</Button>
            <Button variant="ghost">Ghost</Button>
          </div>
        </div>
      </section>

      <section className="card">
        <h2 style={{ margin: "0 0 0.75rem", fontSize: "1.05rem" }}>Iconos (Lucide)</h2>
        <ul
          style={{
            listStyle: "none",
            margin: 0,
            padding: 0,
            display: "grid",
            gap: "0.65rem",
          }}
        >
          <IconRow icon={<Users size={20} />} label="Clientes" />
          <IconRow icon={<Route size={20} />} label="Rutas / visitas" />
          <IconRow icon={<Package size={20} />} label="Inventario" />
          <IconRow icon={<MapPin size={20} />} label="GPS / mapa" />
        </ul>
      </section>
    </div>
  );
}

function IconRow({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <li style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: 40,
          height: 40,
          borderRadius: "var(--radius-chip)",
          background: "var(--secondary)",
          color: "var(--primary)",
        }}
      >
        {icon}
      </span>
      <span style={{ fontWeight: 600 }}>{label}</span>
    </li>
  );
}
