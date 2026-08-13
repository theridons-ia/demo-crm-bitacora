import { useState, type FormEvent } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { BrandLogo } from "../components/BrandLogo";
import { Button } from "../components/Button";
import { TextField } from "../components/TextField";
import { ApiError } from "../lib/api";

function homeForRole(role: string): string {
  return role === "vendedor" ? "/app/inicio" : "/sup/hoy";
}

export function LoginPage() {
  const { user, loading, login } = useAuth();
  const [email, setEmail] = useState("marina@bitacora.local");
  const [password, setPassword] = useState("demo1234");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!loading && user) {
    return <Navigate to={homeForRole(user.role)} replace />;
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(email.trim(), password);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "No se pudo iniciar sesión";
      setError(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="app-shell login-shell">
      <header className="login-header">
        <BrandLogo size={72} className="login-logo" />
        <p className="eyebrow">EnRutas</p>
        <h1 className="display-title">Entrar a la ruta.</h1>
        <p className="muted">Visitas, ventas y evidencia GPS · vendedor y supervisor.</p>
      </header>

      <form className="card login-card" onSubmit={onSubmit}>
        <TextField
          id="email"
          label="Email"
          type="email"
          autoComplete="username"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <TextField
          id="password"
          label="Contraseña"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        {error ? <p className="form-error" role="alert">{error}</p> : null}

        <Button type="submit" variant="accent" block disabled={submitting}>
          {submitting ? "Entrando…" : "Entrar"}
        </Button>

        <p className="muted hint">
          Vendedor: <code>marina@bitacora.local</code> · Supervisor:{" "}
          <code>supervisor@bitacora.local</code> · pass <code>demo1234</code>
        </p>
      </form>
    </div>
  );
}
