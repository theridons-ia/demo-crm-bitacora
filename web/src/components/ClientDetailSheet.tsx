import { ExternalLink, MapPin, Phone, Store } from "lucide-react";
import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Button } from "./Button";
import { Modal } from "./Modal";
import { clientPdvIconFor } from "../lib/mapMarkers";
import { mapsNavigateUrl } from "../lib/gps";
import type { Client } from "../lib/types";

type Props = {
  client: Client;
  open: boolean;
  onClose: () => void;
  onEdit: () => void;
  sellerLabel?: string;
  assignLabel?: string;
  onAssign?: () => void;
};

function hasPdvPin(client: Client): boolean {
  if (client.latitude == null || client.longitude == null) return false;
  return Number.isFinite(Number(client.latitude)) && Number.isFinite(Number(client.longitude));
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

function idLabel(client: Client): string {
  if (client.rif) return `RIF ${client.rif}`;
  if (client.ci) return `CI ${client.ci}`;
  return "Sin identificación";
}

/** Ficha de cliente: datos densos + GPS accionable (Modal centrado). */
export function ClientDetailSheet({
  client,
  open,
  onClose,
  onEdit,
  sellerLabel,
  assignLabel,
  onAssign,
}: Props) {
  const mapEl = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const pinned = hasPdvPin(client);
  const lat = pinned ? Number(client.latitude) : null;
  const lng = pinned ? Number(client.longitude) : null;
  const mapsHref = lat != null && lng != null ? mapsNavigateUrl(lat, lng) : null;

  useEffect(() => {
    if (!open || !pinned || !mapEl.current || lat == null || lng == null) return;

    if (mapRef.current) {
      mapRef.current.remove();
      mapRef.current = null;
    }

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
  }, [open, client, pinned, lat, lng]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="wide"
      eyebrow="Ficha de cliente"
      title={client.name}
      blurb={
        [client.state, pinned ? "Con pin GPS" : "Sin pin de mapa"].filter(Boolean).join(" · ")
      }
      footer={
        <div className="side-sheet-actions">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cerrar
          </Button>
          {onAssign ? (
            <Button type="button" variant="secondary" onClick={onAssign}>
              {assignLabel ?? "Asignar"}
            </Button>
          ) : null}
          <Button type="button" variant="accent" onClick={onEdit}>
            Editar datos y pin
          </Button>
        </div>
      }
    >
      <div className="profile-ficha">
        <div className="visit-ficha-id">
          <span className="visit-ficha-avatar" aria-hidden>
            {initials(client.name)}
          </span>
          <div className="visit-ficha-id-copy">
            <p className="eyebrow">Punto de venta</p>
            <strong>{client.name}</strong>
            <span className="muted small">
              {idLabel(client)}
              {client.state ? ` · ${client.state}` : ""}
            </span>
          </div>
          <span className={`badge ${pinned ? "badge-completada" : "badge-programada"}`}>
            {pinned ? "En mapa" : "Sin pin"}
          </span>
        </div>

        <div className="visit-ficha-facts">
          <article className="visit-ficha-fact">
            <span className="muted small">Identificación</span>
            <strong>{idLabel(client)}</strong>
          </article>
          <article className="visit-ficha-fact">
            <span className="muted small">Vendedor</span>
            <strong>{sellerLabel ?? "Sin vendedor"}</strong>
          </article>
          {client.phone ? (
            <article className="visit-ficha-fact">
              <span className="muted small">
                <Phone size={12} /> Teléfono
              </span>
              <strong>
                <a className="profile-ficha-link" href={`tel:${client.phone.replace(/\s+/g, "")}`}>
                  {client.phone}
                </a>
              </strong>
            </article>
          ) : (
            <article className="visit-ficha-fact">
              <span className="muted small">Teléfono</span>
              <strong>Sin teléfono</strong>
            </article>
          )}
          <article className="visit-ficha-fact">
            <span className="muted small">Estado</span>
            <strong>{client.is_active ? "Activo" : "Inactivo"}</strong>
          </article>
          {client.address ? (
            <article className="visit-ficha-fact visit-ficha-fact-wide">
              <span className="muted small">Dirección / referencia</span>
              <strong>{client.address}</strong>
            </article>
          ) : null}
          {client.notes ? (
            <article className="visit-ficha-fact visit-ficha-fact-wide">
              <span className="muted small">Notas</span>
              <strong>{client.notes}</strong>
            </article>
          ) : null}
        </div>

        <section className={`visit-gps-card ${pinned ? "has-fix" : "needs-fix"}`.trim()}>
          <div className="visit-gps-copy">
            <p className="eyebrow">
              <Store size={12} aria-hidden /> Ubicación GPS
            </p>
            {pinned && lat != null && lng != null ? (
              <>
                <strong>
                  {lat.toFixed(5)}, {lng.toFixed(5)}
                </strong>
                <span className="muted small">
                  {client.address ?? "Coordenada del PDV"}
                </span>
              </>
            ) : (
              <>
                <strong>Sin pin de mapa</strong>
                <span className="muted small">
                  Fija la ubicación para ver el PDV en el mapa y abrir Google Maps.
                </span>
              </>
            )}
          </div>
          <div className="visit-gps-actions">
            {mapsHref ? (
              <a className="btn btn-secondary" href={mapsHref} target="_blank" rel="noreferrer">
                <ExternalLink size={16} />
                Abrir en Maps
              </a>
            ) : null}
            {!pinned ? (
              <Button type="button" variant="accent" onClick={onEdit}>
                <MapPin size={16} />
                Fijar pin
              </Button>
            ) : null}
          </div>
          {pinned ? (
            <div className="map-stage profile-ficha-map">
              <div ref={mapEl} className="client-detail-map" />
            </div>
          ) : null}
        </section>
      </div>
    </Modal>
  );
}
