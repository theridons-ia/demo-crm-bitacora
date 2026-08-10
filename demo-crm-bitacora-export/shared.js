const STORAGE_KEY = "@bitacora-campo/visits";
const SELLER_KEY = "@bitacora-campo/seller";
const DAILY_GOAL = 5;

const SELLERS = [
  { id: "marina", name: "Marina Gómez", initials: "MG", ruta: "Ruta Centro · Lara" },
  { id: "luis", name: "Luis Rojas", initials: "LR", ruta: "Ruta Norte · Yaracuy" },
  { id: "carlos", name: "Carlos Pérez", initials: "CP", ruta: "Ruta Este · Carabobo" },
];

const VISIT_STATUSES = ["Visitado", "No visitado", "Reprogramar"];
const VISIT_RESULTS = ["Venta cerrada", "Venta parcial", "Sin venta"];
const ESTADOS = ["Lara", "Carabobo", "Yaracuy", "Aragua", "Distrito Capital"];

function todayISO() {
  const now = new Date();
  const offset = now.getTimezoneOffset();
  return new Date(now.getTime() - offset * 60000).toISOString().slice(0, 10);
}

function loadVisits() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const visits = raw ? JSON.parse(raw) : [];
    return Array.isArray(visits) ? visits.map(normalizeVisit) : [];
  } catch (error) {
    return [];
  }
}

function saveVisits(visits) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(visits));
}

function clearVisits() {
  localStorage.removeItem(STORAGE_KEY);
}

function loadSellerId() {
  return localStorage.getItem(SELLER_KEY) || SELLERS[0].id;
}

function saveSellerId(id) {
  localStorage.setItem(SELLER_KEY, id);
}

function getSeller(id = loadSellerId()) {
  return SELLERS.find((seller) => seller.id === id) || SELLERS[0];
}

function normalizeVisit(visit) {
  const createdAt = visit.createdAt || new Date().toISOString();
  const date = visit.fecha || createdAt.slice(0, 10);
  return {
    id: visit.id || `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    client: visit.client || visit.cliente || "",
    status: visit.status || "Visitado",
    result: visit.result || visit.resultado || "Sin venta",
    amount: Number(visit.amount ?? visit.monto ?? 0),
    location: visit.location || visit.direccion || visit.estado || "",
    estado: visit.estado || "",
    latitude: visit.latitude ?? visit.lat ?? null,
    longitude: visit.longitude ?? visit.lng ?? null,
    photoUri: visit.photoUri || visit.foto || "",
    notes: visit.notes || visit.nota || "",
    createdAt,
    fecha: date,
    hora: visit.hora || formatTime(createdAt),
    vendedorId: visit.vendedorId || loadSellerId(),
    vendedor: visit.vendedor || getSeller(visit.vendedorId).name,
    ruta: visit.ruta || getSeller(visit.vendedorId).ruta,
  };
}

function formatCurrency(value) {
  return Number(value || 0).toLocaleString("es-VE", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

function formatTime(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString("es-VE", { hour: "numeric", minute: "2-digit" });
}

function formatDateLong(date = new Date()) {
  return date
    .toLocaleDateString("es-VE", {
      weekday: "long",
      day: "numeric",
      month: "long",
    })
    .toUpperCase();
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function mapsUrl(lat, lng, location) {
  if (lat && lng) return `https://www.google.com/maps?q=${encodeURIComponent(`${lat},${lng}`)}`;
  if (location) return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location)}`;
  return "";
}

function isSale(result) {
  return result === "Venta cerrada" || result === "Venta parcial";
}

function visitsToday(visits, date = todayISO()) {
  return visits.filter((visit) => visit.fecha === date);
}

function summarizeVisits(visits) {
  const sales = visits.reduce((sum, visit) => sum + Number(visit.amount || 0), 0);
  const closed = visits.filter((visit) => visit.result === "Venta cerrada").length;
  const partial = visits.filter((visit) => visit.result === "Venta parcial").length;
  const none = visits.filter((visit) => visit.result === "Sin venta").length;
  const withSale = closed + partial;
  return {
    visits: visits.length,
    sales,
    closed,
    partial,
    none,
    withSale,
    effectiveness: visits.length ? Math.round((withSale / visits.length) * 100) : 0,
    goalProgress: Math.min(100, Math.round((visits.length / DAILY_GOAL) * 100)),
    remaining: Math.max(0, DAILY_GOAL - visits.length),
  };
}

function resultBadgeClass(result) {
  if (result === "Venta parcial") return "badge badge-partial";
  if (result === "Venta cerrada") return "badge badge-success";
  return "badge badge-muted";
}

function renderVisitCard(visit, { showAmount = true } = {}) {
  const meta = [visit.estado || visit.location, visit.hora].filter(Boolean).join(" · ");
  const amount = showAmount && Number(visit.amount) > 0
    ? `<strong class="visit-amount">$${formatCurrency(visit.amount)}</strong>`
    : "";

  return `
    <article class="visit-card" data-id="${escapeHtml(visit.id)}">
      <div class="visit-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M20 6L9 17l-5-5"/>
        </svg>
      </div>
      <div class="visit-body">
        <div class="visit-row">
          <h3>${escapeHtml(visit.client)}</h3>
          <span class="${resultBadgeClass(visit.result)}">${escapeHtml(visit.result)}</span>
        </div>
        <p class="meta">${escapeHtml(meta)}</p>
        <div class="visit-footer">
          <p class="notes">${escapeHtml(visit.notes || "Sin observaciones")}</p>
          ${amount}
        </div>
      </div>
    </article>
  `;
}

function compressImage(file, maxWidth = 900, quality = 0.72) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("No se pudo leer la imagen"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Imagen inválida"));
      img.onload = () => {
        const scale = Math.min(1, maxWidth / img.width);
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

async function reverseGeocode(lat, lng) {
  const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lng)}&zoom=18&addressdetails=1`;
  const response = await fetch(url, { headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error("Geocoding falló");
  const data = await response.json();
  return data.display_name || `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
}

function seedDemoVisits() {
  const now = new Date();
  const marina = SELLERS[0];
  const luis = SELLERS[1];
  const carlos = SELLERS[2];
  const samples = [
    {
      client: "Mercado San Rafael",
      status: "Visitado",
      result: "Venta parcial",
      amount: 120,
      location: "San Felipe, Yaracuy",
      estado: "Yaracuy",
      latitude: 10.34,
      longitude: -68.74,
      notes: "Solicitó catálogo de la próxima temporada.",
      createdAt: new Date(now.getTime() - 35 * 60000).toISOString(),
      vendedorId: marina.id,
      vendedor: marina.name,
      ruta: marina.ruta,
    },
    {
      client: "Bodega La Esquina",
      status: "Visitado",
      result: "Sin venta",
      amount: 0,
      location: "Valencia, Carabobo",
      estado: "Carabobo",
      latitude: 10.18,
      longitude: -68.0,
      notes: "Volver a llamar el viernes.",
      createdAt: new Date(now.getTime() - 95 * 60000).toISOString(),
      vendedorId: marina.id,
      vendedor: marina.name,
      ruta: marina.ruta,
    },
    {
      client: "Farmacia Central",
      status: "Visitado",
      result: "Venta cerrada",
      amount: 420,
      location: "Barquisimeto, Lara",
      estado: "Lara",
      latitude: 10.07,
      longitude: -69.32,
      notes: "Pedido completo entregado.",
      createdAt: new Date(now.getTime() - 50 * 60000).toISOString(),
      vendedorId: luis.id,
      vendedor: luis.name,
      ruta: luis.ruta,
    },
    {
      client: "Supermercado Plaza",
      status: "Visitado",
      result: "Venta cerrada",
      amount: 610,
      location: "Caracas, Distrito Capital",
      estado: "Distrito Capital",
      latitude: 10.49,
      longitude: -66.89,
      notes: "Incluye promoción semanal.",
      createdAt: new Date(now.getTime() - 70 * 60000).toISOString(),
      vendedorId: carlos.id,
      vendedor: carlos.name,
      ruta: carlos.ruta,
    },
  ].map(normalizeVisit);

  saveVisits(samples);
  return samples;
}
