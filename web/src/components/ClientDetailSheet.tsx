import { MapPin, Store } from "lucide-react";
import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Button } from "./Button";
import { Modal } from "./Modal";
import { clientPdvIconFor } from "../lib/mapMarkers";
import type { Client } from "../lib/types";

type Props = {
  client: Client;
  open: boolean;
  onClose: () => void;
  onEdit: () => void;
};

function hasPdvPin(client: Client): boolean {
  if (client.latitude == null || client.longitude == null) return false;
  return Number.isFinite(Number(client.latitude)) && Number.isFinite(Number(client.longitude));
}

/** Ficha de cliente: datos + mapa con pin PDV (Modal centrado). */
export function ClientDetailSheet({ client, open, onClose, onEdit }: Props) {
  const mapEl = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const pinned = hasPdvPin(client);

  useEffect(() => {
    if (!open || !pinned || !mapEl.current) return;

    if (mapRef.current) {
      mapRef.current.remove();
      mapRef.current = null;
    }

    const lat = Number(client.latitude);
    const lng = Number(client.longitude);
    const ll: L.LatLngExpression = [lat, lng];

    const map = L.map(mapEl.current, { zoomControl: true }).setView(ll, 16);
    mapRef.current = map;

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>',
    }).addTo(map);

    L.marker(ll, { icon: clientPdvIconFor(client.name) })
      .addTo(map)
      .bindPopup(
        `<strong>${client.name}</strong>${
          client.address ? `<br/><small>${client.address}</small>` : ""
        }`,
      )
      .openPopup();

    const t = window.setTimeout(() => map.invalidateSize(), 120);
    return () => {
      window.clearTimeout(t);
      map.remove();
      mapRef.current = null;
    };
  }, [open, client, pinned]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="wide"
      eyebrow="Ficha de cliente"
      title={client.name}
      blurb={
        client.state
          ? `${client.state} · ${pinned ? "Con ubicación en mapa" : "Sin pin de mapa"}`
          : pinned
            ? "Con ubicación en mapa"
            : "Sin pin de mapa"
      }
      footer={
        <div className="side-sheet-actions">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cerrar
          </Button>
          <Button type="button" variant="accent" onClick={onEdit}>
            Editar datos y pin
          </Button>
        </div>
      }
    >
      <div className="sheet-form-stack">
        <div>
          <p className="field-label">Identificación</p>
          <p>
            {client.rif ? `RIF ${client.rif}` : client.ci ? `CI ${client.ci}` : "Sin identificación"}
          </p>
        </div>
        {client.address ? (
          <div>
            <p className="field-label">Dirección / referencia</p>
            <p>{client.address}</p>
          </div>
        ) : null}
        {client.phone ? (
          <div>
            <p className="field-label">Teléfono</p>
            <p>{client.phone}</p>
          </div>
        ) : null}
        {client.notes ? (
          <div>
            <p className="field-label">Notas</p>
            <p>{client.notes}</p>
          </div>
        ) : null}

        <div>
          <p className="field-label" style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
            <Store size={16} color="#E6007A" aria-hidden />
            Ubicación PDV
          </p>
          {pinned ? (
            <>
              <p className="muted small" style={{ margin: "0 0 0.5rem" }}>
                <MapPin size={14} style={{ verticalAlign: "middle" }} />{" "}
                {Number(client.latitude).toFixed(5)}, {Number(client.longitude).toFixed(5)}
              </p>
              <div className="map-stage">
                <div ref={mapEl} className="client-detail-map" />
              </div>
            </>
          ) : (
            <p className="muted small">
              Este cliente no tiene pin. Usa <strong>Editar datos y pin</strong> para fijar la
              ubicación en el mapa.
            </p>
          )}
        </div>
      </div>
    </Modal>
  );
}
