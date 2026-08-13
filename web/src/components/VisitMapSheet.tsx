import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useEffect, useRef, useState } from "react";
import { Modal } from "./Modal";
import { ApiError, fetchVisitGpsPoints } from "../lib/api";
import { clientPdvIconFor, trailIconForSource } from "../lib/mapMarkers";
import type { Visit, VisitGpsPoint } from "../lib/types";

const SOURCE_LABEL: Record<string, string> = {
  start: "Inicio (vendedor)",
  watch: "Trail (vendedor)",
  end: "Cierre (vendedor)",
};

type Props = {
  visit: Visit;
  open: boolean;
  onClose: () => void;
};

function visitFallbackPoints(visit: Visit): VisitGpsPoint[] {
  if (visit.latitude == null || visit.longitude == null) return [];
  return [
    {
      id: 0,
      visit_id: visit.id,
      latitude: String(visit.latitude),
      longitude: String(visit.longitude),
      accuracy_m: visit.gps_accuracy_m,
      captured_at: visit.gps_captured_at ?? visit.created_at,
      source: visit.status === "completada" ? "end" : "start",
    },
  ];
}

/** Mapa Leaflet: PDV (fucsia + nombre) + trail del vendedor. */
export function VisitMapSheet({ visit, open, onClose }: Props) {
  const mapEl = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const [points, setPoints] = useState<VisitGpsPoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setError(null);

    (async () => {
      if (visit.id < 0) {
        if (!cancelled) {
          setPoints(visitFallbackPoints(visit));
          setLoading(false);
        }
        return;
      }
      try {
        const data = await fetchVisitGpsPoints(visit.id);
        if (cancelled) return;
        setPoints(data.length ? data : visitFallbackPoints(visit));
      } catch (err) {
        if (cancelled) return;
        setPoints(visitFallbackPoints(visit));
        setError(err instanceof ApiError ? err.message : "No se pudieron cargar los puntos");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, visit]);

  useEffect(() => {
    if (!open || !mapEl.current) return;

    if (mapRef.current) {
      mapRef.current.remove();
      mapRef.current = null;
    }

    const map = L.map(mapEl.current, { zoomControl: true, attributionControl: true });
    mapRef.current = map;

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>',
    }).addTo(map);

    const bounds: L.LatLngExpression[] = [];

    const client = visit.client;
    if (client?.latitude != null && client?.longitude != null) {
      const clat = Number(client.latitude);
      const clng = Number(client.longitude);
      if (Number.isFinite(clat) && Number.isFinite(clng)) {
        const ll: L.LatLngExpression = [clat, clng];
        bounds.push(ll);
        L.marker(ll, { icon: clientPdvIconFor(client.name) })
          .addTo(map)
          .bindPopup(
            `<strong>${client.name}</strong>${
              client.address ? `<br/><small>${client.address}</small>` : ""
            }`,
          );
      }
    }

    const latLngs: L.LatLngExpression[] = [];
    for (const p of points) {
      const lat = Number(p.latitude);
      const lng = Number(p.longitude);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
      const ll: L.LatLngExpression = [lat, lng];
      latLngs.push(ll);
      bounds.push(ll);
      const label = SOURCE_LABEL[p.source] ?? p.source;
      const acc = p.accuracy_m ? ` · ±${Number(p.accuracy_m).toFixed(0)} m` : "";
      L.marker(ll, { icon: trailIconForSource(p.source) })
        .addTo(map)
        .bindPopup(`<strong>${label}</strong>${acc}<br/><small>${p.captured_at}</small>`);
    }

    if (latLngs.length >= 2) {
      L.polyline(latLngs, { color: "#f16b5f", weight: 3, opacity: 0.9 }).addTo(map);
    }

    if (bounds.length >= 2) {
      map.fitBounds(L.latLngBounds(bounds), { padding: [36, 36] });
    } else if (bounds.length === 1) {
      map.setView(bounds[0], 16);
    } else {
      map.setView([10.0647, -69.334], 12);
    }

    const t = window.setTimeout(() => map.invalidateSize(), 80);
    return () => {
      window.clearTimeout(t);
      map.remove();
      mapRef.current = null;
    };
  }, [open, points, visit.client]);

  if (!open) return null;

  const clientName = visit.client?.name ?? `Cliente #${visit.client_id}`;
  const hasPdv =
    visit.client?.latitude != null &&
    visit.client?.longitude != null &&
    Number.isFinite(Number(visit.client.latitude));

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="wide"
      eyebrow="Evidencia GPS"
      title={clientName}
      blurb={
        loading
          ? "Cargando puntos…"
          : points.length
            ? `${points.length} punto(s) vendedor${hasPdv ? " · PDV en mapa" : ""}`
            : hasPdv
              ? "Solo pin del PDV (sin trail aún)"
              : "Sin coordenadas"
      }
    >
      {error ? <p className="form-error">{error}</p> : null}

      <div className="map-legend" aria-hidden>
        <span>
          <i className="map-marker-store map-marker-store-legend" /> Cliente (PDV)
        </span>
        <span>
          <i className="map-marker-dot map-marker-dot-start" /> Inicio
        </span>
        <span>
          <i className="map-marker-dot map-marker-dot-seller" /> Trail
        </span>
        <span>
          <i className="map-marker-dot map-marker-dot-end" /> Cierre
        </span>
      </div>

      <div className="card visit-map-card">
        <div ref={mapEl} className="visit-map" />
      </div>
    </Modal>
  );
}
