import { useState, type FormEvent } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { Button } from "../components/Button";
import { TextField } from "../components/TextField";
import { ApiError } from "../lib/api";

export function LoginPage() {
  const { user, loading, login } = useAuth();
  const [email, setEmail] = useState("marina@bitacora.local");
  const [password, setPassword] = useState("demo1234");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!loading && user) {
    return <Navigate to="/clientes" replace />;
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
        <p className="eyebrow">Bitácora Campo</p>
        <h1>Iniciar sesión</h1>
        <p className="muted">SF-0.2 — conectamos el front con FastAPI (JWT).</p>
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

        <Button type="submit" variant="primary" block disabled={submitting}>
          {submitting ? "Entrando…" : "Entrar"}
        </Button>

        <p className="muted hint">
          Demo: <code>marina@bitacora.local</code> / <code>demo1234</code>
        </p>
      </form>
    </div>
  );
}
