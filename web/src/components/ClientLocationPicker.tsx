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

/** Mapa para fijar el pin del PDV (tocar o arrastrar marcador). */
export function ClientLocationPicker({ latitude, longitude, label, onPick }: Props) {
  const mapEl = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const onPickRef = useRef(onPick);
  onPickRef.current = onPick;

  useEffect(() => {
    if (!mapEl.current || mapRef.current) return;

    const map = L.map(mapEl.current, { zoomControl: true }).setView(DEFAULT_CENTER, DEFAULT_ZOOM);
    mapRef.current = map;

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>',
    }).addTo(map);

    map.on("click", (e: L.LeafletMouseEvent) => {
      onPickRef.current(e.latlng.lat, e.latlng.lng);
    });

    const t = window.setTimeout(() => map.invalidateSize(), 100);
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
    } else {
      markerRef.current.setLatLng(ll);
      markerRef.current.setIcon(icon);
      markerRef.current.bindPopup(popupText);
    }
    map.setView(ll, Math.max(map.getZoom(), 15));
  }, [latitude, longitude, label]);

  return <div ref={mapEl} className="client-pick-map" role="application" aria-label="Mapa ubicación PDV" />;
}
