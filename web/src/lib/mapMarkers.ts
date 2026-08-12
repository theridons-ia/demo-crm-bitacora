import L from "leaflet";

/** Iconos Leaflet: PDV (cliente) vs vendedor/trail. */

const PDV_FUCHSIA = "#E6007A";

/** Tienda monocroma fucsia (SVG). */
function pdvStoreSvg(color = PDV_FUCHSIA): string {
  return `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
  <path fill="${color}" d="M4 7.5 6.2 3.8A2 2 0 0 1 7.9 3h8.2a2 2 0 0 1 1.7.8L20 7.5V9a2 2 0 0 1-2 2 1.8 1.8 0 0 1-1.3-.5 1 1 0 0 0-1.4 0A1.8 1.8 0 0 1 14 11a1.8 1.8 0 0 1-1.3-.5 1 1 0 0 0-1.4 0A1.8 1.8 0 0 1 10 11a1.8 1.8 0 0 1-1.3-.5 1 1 0 0 0-1.4 0A1.8 1.8 0 0 1 6 11a2 2 0 0 1-2-2V7.5Z"/>
  <path fill="${color}" d="M5 12h14v7a2 2 0 0 1-2 2h-3.2v-4.2a1.3 1.3 0 0 0-1.3-1.3h-1a1.3 1.3 0 0 0-1.3 1.3V21H7a2 2 0 0 1-2-2v-7Z"/>
</svg>
`.trim();
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function shortenLabel(name: string, max = 22): string {
  const t = name.trim();
  if (!t) return "PDV";
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

/** Pin PDV fucsia con nombre del cliente visible en el mapa. */
export function clientPdvIconFor(clientName?: string | null): L.DivIcon {
  const label = shortenLabel(clientName || "PDV");
  const safe = escapeHtml(label);
  const title = escapeHtml(clientName?.trim() || "PDV");
  return L.divIcon({
    className: "map-marker map-marker-pdv",
    html: `<div class="map-marker-pdv-wrap" title="${title}">
      <span class="map-marker-store">${pdvStoreSvg()}</span>
      <span class="map-marker-pdv-label">${safe}</span>
    </div>`,
    iconSize: [120, 40],
    iconAnchor: [14, 36],
    popupAnchor: [0, -36],
  });
}

/** Compat: pin genérico sin nombre (alta de cliente antes de escribir nombre). */
export const clientPdvIcon = clientPdvIconFor("PDV");

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
