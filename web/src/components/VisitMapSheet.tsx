import L from "leaflet";
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";
import "leaflet/dist/leaflet.css";
import { useEffect, useRef, useState } from "react";
import { Button } from "./Button";
import { ApiError, fetchVisitGpsPoints } from "../lib/api";
import type { Visit, VisitGpsPoint } from "../lib/types";

/* Vite + Leaflet: iconos por defecto rotos con bundlers */
const DefaultIcon = L.icon({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});
L.Marker.prototype.options.icon = DefaultIcon;

const SOURCE_LABEL: Record<string, string> = {
  start: "Inicio",
  watch: "Trail",
  end: "Cierre",
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

/** Mapa Leaflet con trail GPS de una visita (SF-1.10). */
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

    const latLngs: L.LatLngExpression[] = [];
    for (const p of points) {
      const lat = Number(p.latitude);
      const lng = Number(p.longitude);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
      const ll: L.LatLngExpression = [lat, lng];
      latLngs.push(ll);
      const label = SOURCE_LABEL[p.source] ?? p.source;
      const acc = p.accuracy_m ? ` · ±${Number(p.accuracy_m).toFixed(0)} m` : "";
      L.marker(ll)
        .addTo(map)
        .bindPopup(`<strong>${label}</strong>${acc}<br/><small>${p.captured_at}</small>`);
    }

    if (latLngs.length >= 2) {
      L.polyline(latLngs, { color: "#18312f", weight: 3, opacity: 0.85 }).addTo(map);
      map.fitBounds(L.latLngBounds(latLngs), { padding: [36, 36] });
    } else if (latLngs.length === 1) {
      map.setView(latLngs[0], 16);
    } else {
      map.setView([10.0647, -69.334], 12);
    }

    const t = window.setTimeout(() => map.invalidateSize(), 80);
    return () => {
      window.clearTimeout(t);
      map.remove();
      mapRef.current = null;
    };
  }, [open, points]);

  if (!open) return null;

  const clientName = visit.client?.name ?? `Cliente #${visit.client_id}`;

  return (
    <div className="screen-form" role="dialog" aria-modal="true" aria-labelledby="visit-map-title">
      <header className="page-header">
        <div>
          <p className="eyebrow">Evidencia GPS</p>
          <h1 id="visit-map-title">{clientName}</h1>
          <p className="muted">
            {loading
              ? "Cargando puntos…"
              : points.length
                ? `${points.length} punto(s) · inicio / trail / cierre`
                : "Sin coordenadas para esta visita"}
          </p>
        </div>
        <Button variant="ghost" type="button" onClick={onClose}>
          Volver
        </Button>
      </header>

      {error ? <p className="form-error">{error}</p> : null}

      <div className="card visit-map-card">
        <div ref={mapEl} className="visit-map" />
      </div>
    </div>
  );
}
