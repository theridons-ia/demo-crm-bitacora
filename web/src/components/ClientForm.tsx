import { useState, type FormEvent } from "react";
import { Button } from "./Button";
import { TextField } from "./TextField";
import { ApiError, createClient, type ClientCreateInput } from "../lib/api";
import type { Client } from "../lib/types";

type Props = {
  open: boolean;
  onClose: () => void;
  onCreated: (client: Client) => void;
};

const empty = {
  name: "",
  rif: "",
  ci: "",
  state: "",
  address: "",
  phone: "",
  notes: "",
};

/** Formulario de alta — RIF y/o CI obligatorios (validación también en API). */
export function ClientForm({ open, onClose, onCreated }: Props) {
  const [form, setForm] = useState(empty);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!open) return null;

  function setField(key: keyof typeof empty, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    const rif = form.rif.trim() || null;
    const ci = form.ci.trim() || null;
    if (!rif && !ci) {
      setError("Debes indicar RIF y/o CI");
      return;
    }

    const payload: ClientCreateInput = {
      name: form.name.trim(),
      rif,
      ci,
      state: form.state.trim() || null,
      address: form.address.trim() || null,
      phone: form.phone.trim() || null,
      notes: form.notes.trim() || null,
    };

    setSubmitting(true);
    try {
      const created = await createClient(payload);
      setForm(empty);
      onCreated(created);
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo crear el cliente");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="screen-form" role="dialog" aria-modal="true" aria-labelledby="client-form-title">
      <header className="page-header">
        <div>
          <p className="eyebrow">Clientes</p>
          <h1 id="client-form-title">Nuevo cliente</h1>
          <p className="muted">Identificación Venezuela: RIF y/o CI.</p>
        </div>
        <Button variant="ghost" type="button" onClick={onClose}>
          Cerrar
        </Button>
      </header>

      <form className="card form-stack" onSubmit={onSubmit}>
        <TextField
          id="client-name"
          label="Nombre / razón social"
          value={form.name}
          onChange={(e) => setField("name", e.target.value)}
          required
          autoFocus
        />
        <div className="form-row">
          <TextField
            id="client-rif"
            label="RIF"
            placeholder="J-12345678-9"
            value={form.rif}
            onChange={(e) => setField("rif", e.target.value)}
          />
          <TextField
            id="client-ci"
            label="CI"
            placeholder="V-12345678"
            value={form.ci}
            onChange={(e) => setField("ci", e.target.value)}
          />
        </div>
        <TextField
          id="client-state"
          label="Estado"
          placeholder="Lara"
          value={form.state}
          onChange={(e) => setField("state", e.target.value)}
        />
        <TextField
          id="client-address"
          label="Dirección"
          value={form.address}
          onChange={(e) => setField("address", e.target.value)}
        />
        <TextField
          id="client-phone"
          label="Teléfono"
          type="tel"
          value={form.phone}
          onChange={(e) => setField("phone", e.target.value)}
        />
        <TextField
          id="client-notes"
          label="Notas"
          value={form.notes}
          onChange={(e) => setField("notes", e.target.value)}
        />

        {error ? (
          <p className="form-error" role="alert">
            {error}
          </p>
        ) : null}

        <Button type="submit" variant="accent" block disabled={submitting}>
          {submitting ? "Guardando…" : "Guardar cliente"}
        </Button>
      </form>
    </div>
  );
}
