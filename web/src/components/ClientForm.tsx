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

type IdType = "rif" | "ci";

const empty = {
  name: "",
  idValue: "",
  state: "",
  address: "",
  phone: "",
  notes: "",
};

/** Alta de cliente VE: un solo identificador — RIF (jurídica) o CI (natural). */
export function ClientForm({ open, onClose, onCreated }: Props) {
  const [form, setForm] = useState(empty);
  const [idType, setIdType] = useState<IdType>("rif");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!open) return null;

  function setField(key: keyof typeof empty, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    const idValue = form.idValue.trim();
    if (!idValue) {
      setError(idType === "rif" ? "Indica el RIF" : "Indica la CI");
      return;
    }

    const payload: ClientCreateInput = {
      name: form.name.trim(),
      rif: idType === "rif" ? idValue : null,
      ci: idType === "ci" ? idValue : null,
      state: form.state.trim() || null,
      address: form.address.trim() || null,
      phone: form.phone.trim() || null,
      notes: form.notes.trim() || null,
    };

    setSubmitting(true);
    try {
      const created = await createClient(payload);
      setForm(empty);
      setIdType("rif");
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
          <p className="muted">Un identificador: RIF (empresa) o CI (persona).</p>
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

        <div className="field">
          <span className="field-label">Tipo de identificación</span>
          <div className="id-type-toggle" role="group" aria-label="Tipo de identificación">
            <button
              type="button"
              className={idType === "rif" ? "chip active" : "chip"}
              onClick={() => {
                setIdType("rif");
                setField("idValue", "");
              }}
            >
              RIF
            </button>
            <button
              type="button"
              className={idType === "ci" ? "chip active" : "chip"}
              onClick={() => {
                setIdType("ci");
                setField("idValue", "");
              }}
            >
              CI
            </button>
          </div>
        </div>

        <TextField
          id="client-id"
          label={idType === "rif" ? "RIF" : "Cédula de identidad"}
          placeholder={idType === "rif" ? "J-12345678-9" : "V-12345678"}
          value={form.idValue}
          onChange={(e) => setField("idValue", e.target.value)}
          required
        />

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
