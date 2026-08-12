import L from "leaflet";

/** Iconos Leaflet: PDV (cliente) vs vendedor/trail. */

/** Tienda monocroma verde (SVG; los emoji del SO traen varios colores). */
const PDV_STORE_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="26" height="26" aria-hidden="true">
  <path fill="#2f6b4f" d="M4 7.5 6.2 3.8A2 2 0 0 1 7.9 3h8.2a2 2 0 0 1 1.7.8L20 7.5V9a2 2 0 0 1-2 2 1.8 1.8 0 0 1-1.3-.5 1 1 0 0 0-1.4 0A1.8 1.8 0 0 1 14 11a1.8 1.8 0 0 1-1.3-.5 1 1 0 0 0-1.4 0A1.8 1.8 0 0 1 10 11a1.8 1.8 0 0 1-1.3-.5 1 1 0 0 0-1.4 0A1.8 1.8 0 0 1 6 11a2 2 0 0 1-2-2V7.5Z"/>
  <path fill="#2f6b4f" d="M5 12h14v7a2 2 0 0 1-2 2h-3.2v-4.2a1.3 1.3 0 0 0-1.3-1.3h-1a1.3 1.3 0 0 0-1.3 1.3V21H7a2 2 0 0 1-2-2v-7Z"/>
</svg>
`.trim();

export const clientPdvIcon = L.divIcon({
  className: "map-marker map-marker-pdv",
  html: `<span class="map-marker-store" title="PDV">${PDV_STORE_SVG}</span>`,
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
