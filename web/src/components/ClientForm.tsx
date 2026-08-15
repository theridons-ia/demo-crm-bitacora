import { useEffect, useMemo, useState, type FormEvent } from "react";
import { MapPin, Store } from "lucide-react";
import { Button } from "./Button";
import { ClientLocationPicker } from "./ClientLocationPicker";
import { Modal } from "./Modal";
import { FormStep } from "./SideSheet";
import { SelectField, TextAreaField, TextField } from "./TextField";
import {
  ApiError,
  createClient,
  fetchClientAssignments,
  updateClient,
  updateClientAssignments,
  type ClientCreateInput,
} from "../lib/api";
import { getCurrentPosition } from "../lib/gps";
import type { Client, User } from "../lib/types";

type Props = {
  open: boolean;
  onClose: () => void;
  initialClient?: Client | null;
  onSaved: (client: Client) => void;
  /** Supervisor: lista para asignar un vendedor (desplegable). */
  sellers?: User[];
};

type IdType = "rif" | "ci";

const empty = {
  name: "",
  idValue: "",
  state: "",
  city: "",
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
      city: client.city || "",
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

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

/** Alta / edición de cliente — Modal centrado + pasos. */
export function ClientForm({
  open,
  onClose,
  initialClient = null,
  onSaved,
  sellers,
}: Props) {
  const editing = Boolean(initialClient?.id);
  const canAssign = Boolean(sellers?.length);
  const [form, setForm] = useState(empty);
  const [idType, setIdType] = useState<IdType>("rif");
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [sellerId, setSellerId] = useState<number | "">("");
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
    setSellerId("");

    if (!canAssign || !sellers) return;
    if (editing && initialClient) {
      void (async () => {
        for (const s of sellers) {
          try {
            const row = await fetchClientAssignments(s.id);
            if (row.client_ids.includes(initialClient.id)) {
              setSellerId(s.id);
              return;
            }
          } catch {
            /* ignore */
          }
        }
      })();
    } else if (sellers.length === 1) {
      setSellerId(sellers[0].id);
    }
  }, [open, initialClient, canAssign, sellers, editing]);

  const previewId = useMemo(() => {
    const v = form.idValue.trim();
    if (!v) return idType === "rif" ? "Sin RIF" : "Sin CI";
    return v;
  }, [form.idValue, idType]);

  const sellerName = useMemo(() => {
    if (sellerId === "" || !sellers) return null;
    return sellers.find((s) => s.id === sellerId)?.full_name ?? null;
  }, [sellerId, sellers]);

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

  /** Un solo vendedor responsable: queda solo en esa cartera. */
  async function syncPrimarySeller(clientId: number) {
    if (!sellers?.length) return;
    await Promise.all(
      sellers.map(async (s) => {
        const row = await fetchClientAssignments(s.id);
        const next = new Set(row.client_ids);
        if (sellerId !== "" && s.id === sellerId) next.add(clientId);
        else next.delete(clientId);
        const same =
          next.size === row.client_ids.length && row.client_ids.every((id) => next.has(id));
        if (!same) await updateClientAssignments(s.id, Array.from(next));
      }),
    );
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    const idValue = form.idValue.trim();
    if (!idValue) {
      setError(idType === "rif" ? "Indica el RIF" : "Indica la CI");
      return;
    }

    if (form.city.trim().length < 2) {
      setError("Indica la ciudad del PDV");
      return;
    }

    const payload: ClientCreateInput = {
      name: form.name.trim(),
      rif: idType === "rif" ? idValue : null,
      ci: idType === "ci" ? idValue : null,
      state: form.state.trim() || null,
      city: form.city.trim(),
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
      if (canAssign) await syncPrimarySeller(saved.id);
      if (!editing) {
        setForm(empty);
        setIdType("rif");
        setLatitude(null);
        setLongitude(null);
        setSellerId("");
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
    <Modal
      open={open}
      onClose={onClose}
      size="wide"
      eyebrow={editing ? "Clientes · edición" : "Clientes · alta"}
      title={editing ? "Editar cliente" : "Nuevo cliente"}
      blurb="Identificación, ubicación del PDV y contacto."
      footer={
        <div className="side-sheet-actions">
          <Button type="button" variant="ghost" disabled={submitting} onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" form="client-form" variant="accent" disabled={submitting}>
            {submitting ? "Guardando…" : editing ? "Guardar cambios" : "Guardar cliente"}
          </Button>
        </div>
      }
    >
      <div className="modal-layout">
        <form id="client-form" className="sheet-form-stack" onSubmit={onSubmit}>
          <FormStep step="01" title="Identificación" blurb="Datos fiscales y dirección escrita.">
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
                  Cédula
                </button>
              </div>
            </div>

            <div className="form-grid-2">
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
            </div>
            <TextField
              id="client-city"
              label="Ciudad"
              placeholder="Barquisimeto"
              value={form.city}
              onChange={(e) => setField("city", e.target.value)}
              required
            />

            <TextField
              id="client-address"
              label="Dirección / referencia"
              placeholder="Ej. Calle 20 entre 19 y 21, frente al abasto…"
              value={form.address}
              onChange={(e) => setField("address", e.target.value)}
            />
          </FormStep>

          <FormStep step="02" title="Ubicación" blurb="Pin del PDV. Se puede actualizar después.">
            <div className="map-stage">
              <ClientLocationPicker
                latitude={latitude}
                longitude={longitude}
                label={form.name.trim() || "PDV"}
                onPick={onPick}
              />
            </div>
            <div className="ficha-actions" style={{ marginTop: "0.65rem" }}>
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
          </FormStep>

          <FormStep
            step="03"
            title={canAssign ? "Contacto y asignación" : "Contacto"}
            blurb={canAssign ? "Teléfono, notas y vendedor responsable." : "Teléfono y notas."}
          >
            <TextField
              id="client-phone"
              label="Teléfono"
              type="tel"
              value={form.phone}
              onChange={(e) => setField("phone", e.target.value)}
            />
            <TextAreaField
              id="client-notes"
              label="Notas internas"
              value={form.notes}
              onChange={(e) => setField("notes", e.target.value)}
              placeholder="Horario, contacto, referencias…"
            />
            {canAssign && sellers ? (
              <SelectField
                id="client-seller"
                label="Vendedor asignado"
                value={sellerId === "" ? "" : String(sellerId)}
                onChange={(e) => setSellerId(e.target.value ? Number(e.target.value) : "")}
                hint="Quién verá este PDV en su cartera."
              >
                <option value="">Sin asignar</option>
                {sellers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.full_name}
                    {s.route_name ? ` · ${s.route_name}` : ""}
                  </option>
                ))}
              </SelectField>
            ) : null}
          </FormStep>

          {error ? (
            <p className="form-error" role="alert">
              {error}
            </p>
          ) : null}
          <p className="muted small sheet-form-safe">Guardado seguro y visible para el equipo.</p>
        </form>

        <aside className="modal-aside">
          <section className="card form-preview-card">
            <p className="eyebrow">Vista previa</p>
            <div className="form-preview-row">
              <span className="form-preview-avatar" aria-hidden>
                {form.name.trim() ? initials(form.name) : <Store size={16} />}
              </span>
              <div>
                <strong>{form.name.trim() || "Nombre del PDV"}</strong>
                <p className="muted small">{previewId}</p>
              </div>
            </div>
            <p className="muted small" style={{ marginBottom: 0 }}>
              {[form.city.trim() || null, form.state.trim() || null, form.address.trim() || null]
                .filter(Boolean)
                .join(" · ") ||
                "Sin dirección aún"}
            </p>
            {latitude != null && longitude != null ? (
              <p className="gps-ok-note" style={{ marginTop: "0.55rem", marginBottom: 0 }}>
                Pin {latitude.toFixed(4)}, {longitude.toFixed(4)}
              </p>
            ) : (
              <p className="muted small" style={{ marginTop: "0.55rem", marginBottom: 0 }}>
                Sin pin en mapa
              </p>
            )}
            {canAssign ? (
              <p className={`ficha-follow${sellerName ? "" : " is-warn"}`} style={{ marginTop: "0.55rem" }}>
                {sellerName ?? "Sin vendedor"}
              </p>
            ) : null}
          </section>

          <section className="card form-tip-card">
            <p className="eyebrow">Tip</p>
            <p className="muted small" style={{ margin: 0 }}>
              Guarda el pin estando en el PDV: mejora las alertas de GPS al cerrar visitas.
            </p>
          </section>
        </aside>
      </div>
    </Modal>
  );
}
