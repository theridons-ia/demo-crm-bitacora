import L from "leaflet";

/** Iconos Leaflet: PDV (cliente) vs vendedor/trail. */

export const clientPdvIcon = L.divIcon({
  className: "map-marker map-marker-pdv",
  html: '<span class="map-marker-emoji" title="PDV" aria-hidden="true">🏪</span>',
  iconSize: [28, 28],
  iconAnchor: [14, 14],
  popupAnchor: [0, -14],
});

export const sellerTrailIcon = L.divIcon({
  className: "map-marker map-marker-seller",
  html: '<span class="map-marker-dot map-marker-dot-seller" title="Vendedor"></span>',
  iconSize: [18, 18],
  iconAnchor: [9, 9],
  popupAnchor: [0, -10],
});

export const sellerStartIcon = L.divIcon({
  className: "map-marker map-marker-seller",
  html: '<span class="map-marker-dot map-marker-dot-start" title="Inicio"></span>',
  iconSize: [20, 20],
  iconAnchor: [10, 10],
  popupAnchor: [0, -10],
});

export const sellerEndIcon = L.divIcon({
  className: "map-marker map-marker-seller",
  html: '<span class="map-marker-dot map-marker-dot-end" title="Cierre"></span>',
  iconSize: [20, 20],
  iconAnchor: [10, 10],
  popupAnchor: [0, -10],
});

export function trailIconForSource(source: string): L.DivIcon {
  if (source === "start") return sellerStartIcon;
  if (source === "end") return sellerEndIcon;
  return sellerTrailIcon;
}
