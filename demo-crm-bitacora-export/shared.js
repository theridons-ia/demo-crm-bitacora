const STORAGE_KEY = "@bitacora-campo/visits";
const SELLER_KEY = "@bitacora-campo/seller";
const DAILY_GOAL = 5;

const SELLERS = [
  { id: "marina", name: "Marina Gómez", initials: "MG", ruta: "Ruta Centro · Lara" },
  { id: "luis", name: "Luis Rojas", initials: "LR", ruta: "Ruta Norte · Yaracuy" },
  { id: "carlos", name: "Carlos Pérez", initials: "CP", ruta: "Ruta Este · Carabobo" },
];

const PRODUCTS = [
  { id: "cola1", name: "Cola #1", price: 12, unit: "caja" },
  { id: "cola2", name: "Cola #2", price: 15, unit: "caja" },
  { id: "leche", name: "Leche ABC", price: 8, unit: "pack" },
];

const ESTADOS = ["Lara", "Carabobo", "Yaracuy", "Aragua", "Distrito Capital"];
const FOLLOW_UPS = [
  { id: "none", label: "Sin seguimiento" },
  { id: "call", label: "Llamar luego" },
  { id: "schedule", label: "Agendar otra visita" },
];

function todayISO() {
  const now = new Date();
  const offset = now.getTimezoneOffset();
  return new Date(now.getTime() - offset * 60000).toISOString().slice(0, 10);
}

function addDaysISO(iso, days) {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(y, m - 1, d + days);
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60000).toISOString().slice(0, 10);
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

function getProduct(id) {
  return PRODUCTS.find((product) => product.id === id);
}

function normalizeLines(lines) {
  if (!Array.isArray(lines)) return [];
  return lines
    .map((line) => {
      const product = getProduct(line.productId) || {
        id: line.productId,
        name: line.name,
        price: line.unitPrice,
      };
      const qty = Math.max(0, Number(line.qty || 0));
      const unitPrice = Number(line.unitPrice ?? product.price ?? 0);
      return {
        productId: product.id,
        name: line.name || product.name,
        unitPrice,
        qty,
        total: qty * unitPrice,
      };
    })
    .filter((line) => line.qty > 0);
}

function linesTotal(lines) {
  return normalizeLines(lines).reduce((sum, line) => sum + line.total, 0);
}

function deriveStatus(visit) {
  if (visit.status === "Programada" || visit.kind === "scheduled" || visit.result === "Programada") {
    return "Programada";
  }
  if (visit.status === "En curso" || visit.kind === "in_progress") return "En curso";
  if (visit.status === "Cancelada") return "Cancelada";
  if (visit.status === "Completada" || visit.kind === "completed" || visit.kind === "sale") {
    return "Completada";
  }
  if (visit.status === "Visitado" || visit.status === "No visitado" || visit.status === "Reprogramar") {
    return "Completada";
  }
  return visit.status || "Completada";
}

function normalizeVisit(visit) {
  const createdAt = visit.createdAt || new Date().toISOString();
  const lines = normalizeLines(visit.lines);
  const status = deriveStatus(visit);
  const date = visit.fecha || visit.scheduledDate || createdAt.slice(0, 10);
  const amountFromLines = linesTotal(lines);
  const result = status === "Completada"
    ? (visit.result && visit.result !== "Programada" ? visit.result : (visit.resultado || "Sin venta"))
    : "";

  return {
    id: visit.id || `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    status,
    result,
    saleOnly: Boolean(visit.saleOnly),
    relatedVisitId: visit.relatedVisitId || "",
    client: visit.client || visit.cliente || "",
    amount: amountFromLines || Number(visit.amount ?? visit.monto ?? 0),
    lines,
    location: visit.location || visit.direccion || visit.estado || "",
    estado: visit.estado || "",
    latitude: visit.latitude ?? visit.lat ?? null,
    longitude: visit.longitude ?? visit.lng ?? null,
    photoUri: visit.photoUri || visit.foto || "",
    notes: visit.notes || visit.nota || "",
    followUp: visit.followUp || "none",
    createdAt,
    fecha: date,
    scheduledDate: visit.scheduledDate || (status === "Programada" ? date : ""),
    hora: visit.hora || (status === "Programada" ? "" : formatTime(createdAt)),
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

function formatDateShort(iso) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("es-VE", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function isSale(result) {
  return result === "Venta cerrada" || result === "Venta parcial";
}

function isOpenVisit(visit) {
  return visit.status === "Programada" || visit.status === "En curso";
}

function isCompleted(visit) {
  return visit.status === "Completada";
}

function completedVisits(visits) {
  return visits.filter(isCompleted);
}

function openVisits(visits) {
  return visits.filter(isOpenVisit);
}

function scheduledVisits(visits) {
  return visits.filter((visit) => visit.status === "Programada");
}

function visitsToday(visits, date = todayISO()) {
  return completedVisits(visits).filter((visit) => visit.fecha === date);
}

function summarizeVisits(visits) {
  const completed = completedVisits(visits);
  const sales = completed.reduce((sum, visit) => sum + Number(visit.amount || 0), 0);
  const closed = completed.filter((visit) => visit.result === "Venta cerrada").length;
  const partial = completed.filter((visit) => visit.result === "Venta parcial").length;
  const none = completed.filter((visit) => visit.result === "Sin venta").length;
  const withSale = closed + partial;
  return {
    visits: completed.length,
    sales,
    closed,
    partial,
    none,
    withSale,
    scheduled: scheduledVisits(visits).length,
    inProgress: visits.filter((visit) => visit.status === "En curso").length,
    effectiveness: completed.length ? Math.round((withSale / completed.length) * 100) : 0,
    goalProgress: Math.min(100, Math.round((completed.length / DAILY_GOAL) * 100)),
    remaining: Math.max(0, DAILY_GOAL - completed.length),
  };
}

function badgeForVisit(visit) {
  if (visit.status === "Programada") return { text: "Programada", className: "badge badge-accent" };
  if (visit.status === "En curso") return { text: "En curso", className: "badge badge-progress" };
  if (visit.status === "Cancelada") return { text: "Cancelada", className: "badge badge-muted" };
  if (visit.result === "Venta parcial") return { text: "Venta parcial", className: "badge badge-partial" };
  if (visit.result === "Venta cerrada") return { text: "Venta cerrada", className: "badge badge-success" };
  return { text: visit.result || "Completada", className: "badge badge-muted" };
}

function followUpLabel(id) {
  return FOLLOW_UPS.find((item) => item.id === id)?.label || "";
}

function renderVisitCard(visit) {
  const badge = badgeForVisit(visit);
  const metaParts = [
    visit.estado || visit.location,
    visit.status === "Programada" ? formatDateShort(visit.fecha) : visit.hora,
  ].filter(Boolean);
  const linesLabel = visit.lines?.length
    ? visit.lines.map((line) => `${line.qty}× ${line.name}`).join(" · ")
    : "";
  const amount = Number(visit.amount) > 0
    ? `<strong class="visit-amount">$${formatCurrency(visit.amount)}</strong>`
    : "";
  const follow = visit.followUp && visit.followUp !== "none"
    ? `<p class="meta follow-line">Seguimiento: ${escapeHtml(followUpLabel(visit.followUp))}</p>`
    : "";
  const iconPath = visit.status === "Programada"
    ? '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>'
    : visit.status === "En curso"
      ? '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'
      : '<path d="M20 6L9 17l-5-5"/>';

  return `
    <article class="visit-card" data-id="${escapeHtml(visit.id)}">
      <div class="visit-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2">${iconPath}</svg>
      </div>
      <div class="visit-body">
        <div class="visit-row">
          <h3>${escapeHtml(visit.client)}</h3>
          <span class="${badge.className}">${escapeHtml(badge.text)}</span>
        </div>
        <p class="meta">${escapeHtml(metaParts.join(" · "))}${visit.saleOnly ? " · Venta suelta" : ""}</p>
        ${linesLabel ? `<p class="meta products-line">${escapeHtml(linesLabel)}</p>` : ""}
        ${follow}
        <div class="visit-footer">
          <p class="notes">${escapeHtml(visit.notes || (visit.status === "Programada" ? "En agenda" : "Sin observaciones"))}</p>
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
  const tomorrow = addDaysISO(todayISO(), 1);
  const samples = [
    {
      status: "Completada",
      client: "Mercado San Rafael",
      result: "Venta parcial",
      lines: [{ productId: "cola1", qty: 5 }, { productId: "leche", qty: 8 }],
      location: "San Felipe, Yaracuy",
      estado: "Yaracuy",
      notes: "Cliente pidió catálogo. Quedó en confirmar el resto.",
      followUp: "call",
      createdAt: new Date(now.getTime() - 35 * 60000).toISOString(),
      vendedorId: marina.id,
      vendedor: marina.name,
      ruta: marina.ruta,
    },
    {
      status: "En curso",
      client: "Bodega La Esquina",
      location: "Valencia, Carabobo",
      estado: "Carabobo",
      notes: "Check-in hecho. Negociando pedido.",
      createdAt: new Date(now.getTime() - 20 * 60000).toISOString(),
      vendedorId: marina.id,
      vendedor: marina.name,
      ruta: marina.ruta,
    },
    {
      status: "Programada",
      client: "Abastos El Río",
      scheduledDate: tomorrow,
      fecha: tomorrow,
      estado: "Lara",
      location: "Barquisimeto",
      notes: "Llevar promoción de Cola #2.",
      createdAt: now.toISOString(),
      vendedorId: marina.id,
      vendedor: marina.name,
      ruta: marina.ruta,
    },
    {
      status: "Completada",
      client: "Farmacia Central",
      result: "Venta cerrada",
      lines: [{ productId: "cola2", qty: 20 }, { productId: "cola1", qty: 10 }],
      estado: "Lara",
      notes: "Pedido completo entregado.",
      createdAt: new Date(now.getTime() - 50 * 60000).toISOString(),
      vendedorId: luis.id,
      vendedor: luis.name,
      ruta: luis.ruta,
    },
    {
      status: "Completada",
      client: "Supermercado Plaza",
      result: "Venta cerrada",
      saleOnly: true,
      lines: [{ productId: "leche", qty: 40 }, { productId: "cola2", qty: 18 }],
      estado: "Distrito Capital",
      notes: "Pedido por llamada (venta sin visita).",
      createdAt: new Date(now.getTime() - 70 * 60000).toISOString(),
      vendedorId: carlos.id,
      vendedor: carlos.name,
      ruta: carlos.ruta,
    },
  ].map(normalizeVisit);

  saveVisits(samples);
  return samples;
}
