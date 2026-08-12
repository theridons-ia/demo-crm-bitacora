import { useEffect, useState, type FormEvent } from "react";
import { MapPin } from "lucide-react";
import { Button } from "./Button";
import { ClientLocationPicker } from "./ClientLocationPicker";
import { TextField } from "./TextField";
import { ApiError, createClient, updateClient, type ClientCreateInput } from "../lib/api";
import { getCurrentPosition } from "../lib/gps";
import type { Client } from "../lib/types";

type Props = {
  open: boolean;
  onClose: () => void;
  /** Si viene, modo edición. */
  initialClient?: Client | null;
  onSaved: (client: Client) => void;
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

function hydrate(client: Client | null | undefined) {
  if (!client) {
    return {
      form: empty,
      idType: "rif" as IdType,
      latitude: null as number | null,
      longitude: null as number | null,
    };
  }
  const idType: IdType = client.ci && !client.rif ? "ci" : "rif";
  return {
    form: {
      name: client.name,
      idValue: (idType === "rif" ? client.rif : client.ci) || "",
      state: client.state || "",
      address: client.address || "",
      phone: client.phone || "",
      notes: client.notes || "",
    },
    idType,
    latitude:
      client.latitude != null && Number.isFinite(Number(client.latitude))
        ? Number(client.latitude)
        : null,
    longitude:
      client.longitude != null && Number.isFinite(Number(client.longitude))
        ? Number(client.longitude)
        : null,
  };
}

/** Alta / edición de cliente VE: RIF o CI + dirección + pin. */
export function ClientForm({ open, onClose, initialClient = null, onSaved }: Props) {
  const editing = Boolean(initialClient?.id);
  const [form, setForm] = useState(empty);
  const [idType, setIdType] = useState<IdType>("rif");
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [gpsBusy, setGpsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    const h = hydrate(initialClient);
    setForm(h.form);
    setIdType(h.idType);
    setLatitude(h.latitude);
    setLongitude(h.longitude);
    setError(null);
  }, [open, initialClient]);

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
      const saved =
        editing && initialClient
          ? await updateClient(initialClient.id, payload)
          : await createClient(payload);
      if (!editing) {
        setForm(empty);
        setIdType("rif");
        setLatitude(null);
        setLongitude(null);
      }
      onSaved(saved);
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo guardar el cliente");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="screen-form" role="dialog" aria-modal="true" aria-labelledby="client-form-title">
      <header className="page-header">
        <div>
          <p className="eyebrow">Clientes</p>
          <h1 id="client-form-title">{editing ? "Editar cliente" : "Nuevo cliente"}</h1>
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
          {submitting ? "Guardando…" : editing ? "Guardar cambios" : "Guardar cliente"}
        </Button>
      </form>
    </div>
  );
}
