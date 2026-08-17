import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useEffect, useRef } from "react";
import { clientPdvIconFor } from "../lib/mapMarkers";

const DEFAULT_CENTER: L.LatLngExpression = [10.0647, -69.334];
const DEFAULT_ZOOM = 13;

type Props = {
  latitude: number | null;
  longitude: number | null;
  /** Nombre del cliente para la etiqueta del pin. */
  label?: string;
  onPick: (lat: number, lng: number) => void;
};

function farEnough(a: L.LatLng, lat: number, lng: number): boolean {
  return Math.abs(a.lat - lat) > 1e-6 || Math.abs(a.lng - lng) > 1e-6;
}

/** Mapa para fijar el pin del PDV (tocar o arrastrar marcador). */
export function ClientLocationPicker({ latitude, longitude, label, onPick }: Props) {
  const mapEl = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const onPickRef = useRef(onPick);
  onPickRef.current = onPick;
  const origin = useRef({ latitude, longitude });

  useEffect(() => {
    if (!mapEl.current || mapRef.current) return;

    const startLat = origin.current.latitude;
    const startLng = origin.current.longitude;
    const hasPin = startLat != null && startLng != null;
    const map = L.map(mapEl.current, { zoomControl: true }).setView(
      hasPin ? [startLat, startLng] : DEFAULT_CENTER,
      hasPin ? 16 : DEFAULT_ZOOM,
    );
    mapRef.current = map;

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>',
    }).addTo(map);

    map.on("click", (e: L.LeafletMouseEvent) => {
      onPickRef.current(e.latlng.lat, e.latlng.lng);
    });

    const t = window.setTimeout(() => map.invalidateSize(), 120);
    return () => {
      window.clearTimeout(t);
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (latitude == null || longitude == null) {
      markerRef.current?.remove();
      markerRef.current = null;
      return;
    }

    const ll: L.LatLngExpression = [latitude, longitude];
    const icon = clientPdvIconFor(label || "PDV");
    const popupText = `${label?.trim() || "PDV"} · arrastra o toca el mapa`;

    if (!markerRef.current) {
      markerRef.current = L.marker(ll, { icon, draggable: true }).addTo(map).bindPopup(popupText);
      markerRef.current.on("dragend", () => {
        const pos = markerRef.current?.getLatLng();
        if (pos) onPickRef.current(pos.lat, pos.lng);
      });
      map.setView(ll, Math.max(map.getZoom(), 15));
      return;
    }

    markerRef.current.setIcon(icon);
    markerRef.current.bindPopup(popupText);
    const cur = markerRef.current.getLatLng();
    if (farEnough(cur, latitude, longitude)) {
      markerRef.current.setLatLng(ll);
      map.setView(ll, Math.max(map.getZoom(), 15));
    }
  }, [latitude, longitude, label]);

  return <div ref={mapEl} className="client-pick-map" role="application" aria-label="Mapa ubicación PDV" />;
}
