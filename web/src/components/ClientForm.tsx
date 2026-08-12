import { useState, type FormEvent } from "react";
import { MapPin } from "lucide-react";
import { Button } from "./Button";
import { ClientLocationPicker } from "./ClientLocationPicker";
import { TextField } from "./TextField";
import { ApiError, createClient, type ClientCreateInput } from "../lib/api";
import { getCurrentPosition } from "../lib/gps";
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

/** Alta de cliente VE: RIF o CI + dirección escrita + pin en mapa. */
export function ClientForm({ open, onClose, onCreated }: Props) {
  const [form, setForm] = useState(empty);
  const [idType, setIdType] = useState<IdType>("rif");
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [gpsBusy, setGpsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!open) return null;

  function setField(key: keyof typeof empty, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function onPick(lat: number, lng: number) {
    setLatitude(lat);
    setLongitude(lng);
    setError(null);
  }

  async function useMyGps() {
    setGpsBusy(true);
    setError(null);
    try {
      const geo = await getCurrentPosition();
      if (!geo.ok) {
        setError(geo.reason);
        return;
      }
      setLatitude(geo.fix.latitude);
      setLongitude(geo.fix.longitude);
    } finally {
      setGpsBusy(false);
    }
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
      latitude,
      longitude,
    };

    setSubmitting(true);
    try {
      const created = await createClient(payload);
      setForm(empty);
      setIdType("rif");
      setLatitude(null);
      setLongitude(null);
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
          <p className="muted">RIF o CI · dirección escrita · pin del PDV en el mapa.</p>
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
          label="Dirección / referencia"
          placeholder="Ej. Calle 20 entre 19 y 21, frente al abasto…"
          value={form.address}
          onChange={(e) => setField("address", e.target.value)}
        />

        <div className="field">
          <span className="field-label">Ubicación en mapa (PDV)</span>
          <p className="muted small" style={{ margin: "0 0 0.5rem" }}>
            Toca el mapa o usa el GPS estando en el local. El pin fucsia lleva el nombre del cliente.
          </p>
          <div className="client-pick-map-wrap">
            <ClientLocationPicker
              latitude={latitude}
              longitude={longitude}
              label={form.name.trim() || "PDV"}
              onPick={onPick}
            />
          </div>
          <div className="visit-actions" style={{ marginTop: "0.65rem" }}>
            <Button type="button" variant="secondary" disabled={gpsBusy} onClick={useMyGps}>
              <MapPin size={16} />
              {gpsBusy ? "Obteniendo GPS…" : "Usar mi GPS"}
            </Button>
            {latitude != null && longitude != null ? (
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setLatitude(null);
                  setLongitude(null);
                }}
              >
                Quitar pin
              </Button>
            ) : null}
          </div>
          {latitude != null && longitude != null ? (
            <p className="gps-ok-note" style={{ marginTop: "0.5rem" }}>
              Pin: {latitude.toFixed(5)}, {longitude.toFixed(5)}
            </p>
          ) : (
            <p className="muted small" style={{ marginTop: "0.5rem" }}>
              Sin pin (opcional). Sirve para alertar si cierran la visita lejos del PDV.
            </p>
          )}
        </div>

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
