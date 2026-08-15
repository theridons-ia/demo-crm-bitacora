import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useEffect, useMemo, useRef } from "react";
import { teamVisitIcon } from "../lib/mapMarkers";
import type { Visit } from "../lib/types";

const FALLBACK = { lat: 10.07, lng: -69.32 };

function stopCoords(visit: Visit): { lat: number; lng: number } | null {
  const lat = visit.client?.latitude != null ? Number(visit.client.latitude) : NaN;
  const lng = visit.client?.longitude != null ? Number(visit.client.longitude) : NaN;
  if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };
  return null;
}

type Props = {
  visits: Visit[];
  highlightIds?: number[];
};

/** Mapa compacto de paradas (planificador). Coral = recién agregadas. */
export function StopsMiniMap({ visits, highlightIds = [] }: Props) {
  const mapEl = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);
  const highlight = useMemo(() => new Set(highlightIds), [highlightIds]);

  const pinned = useMemo(() => {
    return visits
      .map((v, i) => {
        const c = stopCoords(v);
        return c ? { v, n: i + 1, c, isNew: highlight.has(v.id) } : null;
      })
      .filter((row): row is { v: Visit; n: number; c: { lat: number; lng: number }; isNew: boolean } =>
        Boolean(row),
      );
  }, [visits, highlight]);

  useEffect(() => {
    if (!mapEl.current || pinned.length === 0) return;
    if (!mapRef.current) {
      const map = L.map(mapEl.current, { zoomControl: false, attributionControl: false });
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19 }).addTo(map);
      map.setView([FALLBACK.lat, FALLBACK.lng], 12);
      mapRef.current = map;
      layerRef.current = L.layerGroup().addTo(map);
    }

    const layer = layerRef.current!;
    layer.clearLayers();

    if (pinned.length > 1) {
      L.polyline(
        pinned.map((p) => [p.c.lat, p.c.lng] as L.LatLngExpression),
        { color: "#f16b5f", weight: 3, dashArray: "8 10", opacity: 0.85 },
      ).addTo(layer);
    }

    pinned.forEach(({ v, n, c, isNew }) => {
      L.marker([c.lat, c.lng], {
        icon: teamVisitIcon(isNew ? "en_curso" : "completada", String(n)),
      })
        .bindPopup(
          `<strong>${n}. ${v.client?.name ?? `Cliente #${v.client_id}`}</strong>${isNew ? "<br/>Nueva" : ""}`,
        )
        .addTo(layer);
    });

    const map = mapRef.current;
    map.fitBounds(
      L.latLngBounds(pinned.map((p) => [p.c.lat, p.c.lng] as L.LatLngExpression)),
      { padding: [28, 28], maxZoom: 15 },
    );
    const t = window.setTimeout(() => map.invalidateSize(), 120);
    return () => window.clearTimeout(t);
  }, [pinned]);

  useEffect(() => {
    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
      layerRef.current = null;
    };
  }, []);

  if (pinned.length === 0) {
    return <p className="muted small">Las paradas nuevas aún no tienen pin en el mapa.</p>;
  }

  return (
    <div className="map-stage route-plan-map">
      <div ref={mapEl} className="map-stage-canvas is-plan" role="img" aria-label="Mapa de paradas" />
      <p className="map-stage-legend">
        <span>Coral = nueva</span>
        <span>Teal = ya estaba</span>
      </p>
    </div>
  );
}
