const VISITS_KEY = "@bitacora-campo/visits";
const CLIENTS_KEY = "@bitacora-campo/clients";
const ORDERS_KEY = "@bitacora-campo/orders";
const SELLER_KEY = "@bitacora-campo/seller";
const MIGRATED_KEY = "@bitacora-campo/migrated-v2";
const DAILY_GOAL = 5;

const SELLERS = [
  { id: "marina", name: "Marina Gómez", initials: "MG", ruta: "Ruta Centro · Lara" },
  { id: "luis", name: "Luis Rojas", initials: "LR", ruta: "Ruta Norte · Yaracuy" },
  { id: "carlos", name: "Carlos Pérez", initials: "CP", ruta: "Ruta Este · Carabobo" },
  { id: "ana", name: "Ana Silva", initials: "AS", ruta: "Ruta Sur · Aragua" },
];

const PRODUCTS = [
  { id: "cola1", code: "REF-001", name: "Cola Clásica 2L", category: "Refrescos", unit: "caja", listPrice: 12, wholesalePrice: 10, expiresAt: "2026-12-15", image: "./assets/products/cola1.svg" },
  { id: "cola2", code: "REF-002", name: "Cola Zero 2L", category: "Refrescos", unit: "caja", listPrice: 13, wholesalePrice: 11, expiresAt: "2026-11-30", image: "./assets/products/cola2.svg" },
  { id: "lima", code: "REF-003", name: "Lima-Limón 1.5L", category: "Refrescos", unit: "caja", listPrice: 11, wholesalePrice: 9, expiresAt: "2026-10-20", image: "./assets/products/lima.svg" },
  { id: "naranja", code: "REF-004", name: "Naranja Tropical 2L", category: "Refrescos", unit: "caja", listPrice: 12, wholesalePrice: 10, expiresAt: "2027-01-10", image: "./assets/products/naranja.svg" },
  { id: "agua", code: "REF-005", name: "Agua mineral 600ml", category: "Refrescos", unit: "pack", listPrice: 8, wholesalePrice: 6, expiresAt: "2027-06-01", image: "./assets/products/agua.svg" },
  { id: "leche1", code: "LAC-001", name: "Leche Entera 1L", category: "Lácteos", unit: "pack", listPrice: 9, wholesalePrice: 7, expiresAt: "2026-09-18", image: "./assets/products/leche1.svg" },
  { id: "leche2", code: "LAC-002", name: "Leche Descremada 1L", category: "Lácteos", unit: "pack", listPrice: 9, wholesalePrice: 7, expiresAt: "2026-09-25", image: "./assets/products/leche2.svg" },
  { id: "yogurt", code: "LAC-003", name: "Yogurt Natural 1kg", category: "Lácteos", unit: "unidad", listPrice: 14, wholesalePrice: 12, expiresAt: "2026-08-28", image: "./assets/products/yogurt.svg" },
];

const SEED_CLIENTS = [
  { id: "cli-1", rif: "J-30124567-1", name: "Bodega La Esquina", address: "Av. Bolívar, Valencia", estado: "Carabobo" },
  { id: "cli-2", rif: "J-29876543-2", name: "Mercado San Rafael", address: "Calle 12, San Felipe", estado: "Yaracuy" },
  { id: "cli-3", rif: "V-14567890-3", name: "Abastos El Río", address: "Carrera 19, Barquisimeto", estado: "Lara" },
  { id: "cli-4", rif: "J-31234567-4", name: "Minimarket El Sol", address: "Calle Real, Maracay", estado: "Aragua" },
  { id: "cli-5", rif: "J-28765432-5", name: "Farmacia Central", address: "Av. Vargas, Barquisimeto", estado: "Lara" },
  { id: "cli-6", rif: "J-30567890-6", name: "Supermercado Plaza", address: "Sabana Grande, Caracas", estado: "Distrito Capital" },
];

const ESTADOS = ["Lara", "Carabobo", "Yaracuy", "Aragua", "Distrito Capital"];

const VISIT_MOTIVES = [
  { id: "rutina", label: "Rutina" },
  { id: "nuevos", label: "Ofrecer productos nuevos" },
  { id: "negociar", label: "Negociar" },
  { id: "cobranza", label: "Cobranza" },
  { id: "seguimiento", label: "Seguimiento" },
  { id: "otro", label: "Otro" },
];

const FOLLOW_UPS = [
  { id: "none", label: "Sin seguimiento" },
  { id: "call", label: "Llamar luego" },
  { id: "schedule", label: "Agendar otra visita" },
];

function uid(prefix = "id") {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

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

function loadJson(key, fallback = []) {
  try {
    const raw = localStorage.getItem(key);
    const data = raw ? JSON.parse(raw) : fallback;
    return Array.isArray(data) ? data : fallback;
  } catch (error) {
    return fallback;
  }
}

function saveJson(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
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

function productPrice(product, list = "list") {
  if (!product) return 0;
  return list === "wholesale" ? Number(product.wholesalePrice || 0) : Number(product.listPrice ?? product.price ?? 0);
}

function ensureClientsSeeded() {
  const existing = loadJson(CLIENTS_KEY, null);
  if (!existing || !existing.length) {
    saveJson(CLIENTS_KEY, SEED_CLIENTS.map(normalizeClient));
  }
}

function loadClients() {
  ensureClientsSeeded();
  return loadJson(CLIENTS_KEY).map(normalizeClient);
}

function saveClients(clients) {
  saveJson(CLIENTS_KEY, clients.map(normalizeClient));
}

function getClient(id) {
  return loadClients().find((client) => client.id === id) || null;
}

function upsertClient(client) {
  const clients = loadClients();
  const normalized = normalizeClient(client);
  const index = clients.findIndex((item) => item.id === normalized.id);
  if (index >= 0) clients[index] = normalized;
  else clients.push(normalized);
  saveClients(clients);
  return normalized;
}

function findClientByName(name) {
  const needle = String(name || "").trim().toLowerCase();
  if (!needle) return null;
  return loadClients().find((client) => client.name.toLowerCase() === needle) || null;
}

function normalizeClient(client) {
  return {
    id: client.id || uid("cli"),
    rif: client.rif || "",
    name: client.name || client.nombre || "",
    address: client.address || client.direccion || "",
    estado: client.estado || "",
  };
}

function clientLabel(clientOrId) {
  const client = typeof clientOrId === "string" ? getClient(clientOrId) : clientOrId;
  if (!client) return "Cliente";
  return client.name;
}

function normalizeLines(lines, priceList = "list") {
  if (!Array.isArray(lines)) return [];
  return lines
    .map((line) => {
      const product = getProduct(line.productId) || {
        id: line.productId,
        name: line.name,
        code: line.code || "",
        listPrice: line.unitPrice,
        wholesalePrice: line.unitPrice,
      };
      const qty = Math.max(0, Number(line.qty || 0));
      const unitPrice = Number(line.unitPrice ?? productPrice(product, priceList));
      return {
        productId: product.id,
        code: line.code || product.code || "",
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

function deriveOutcome(visit) {
  if (visit.outcome === "con_venta" || visit.outcome === "sin_venta") return visit.outcome;
  if (visit.result === "Venta cerrada" || visit.result === "Venta parcial") return "con_venta";
  if (visit.result === "Sin venta") return "sin_venta";
  if (visit.status === "Completada") return "sin_venta";
  return "";
}

function resolveClientId(visit) {
  if (visit.clientId && getClient(visit.clientId)) return visit.clientId;
  const byName = findClientByName(visit.client || visit.cliente);
  if (byName) return byName.id;
  const name = visit.client || visit.cliente;
  if (!name) return SEED_CLIENTS[0].id;
  const created = upsertClient({
    name,
    address: visit.location || visit.direccion || "",
    estado: visit.estado || "",
    rif: "J-00000000-0",
  });
  return created.id;
}

function normalizeVisit(visit) {
  const createdAt = visit.createdAt || new Date().toISOString();
  const status = deriveStatus(visit);
  const date = visit.fecha || visit.scheduledDate || createdAt.slice(0, 10);
  const clientId = resolveClientId(visit);
  const client = getClient(clientId);
  const startAt = visit.startAt || (status === "En curso" || status === "Completada" ? createdAt : "");
  const endAt = visit.endAt || (status === "Completada" ? createdAt : "");
  const outcome = status === "Completada" ? deriveOutcome(visit) : "";

  return {
    id: visit.id || uid("vis"),
    clientId,
    clientName: client?.name || visit.client || visit.cliente || "",
    status,
    motive: visit.motive || "",
    outcome,
    result: outcome === "con_venta" ? "Con venta" : outcome === "sin_venta" ? "Sin venta" : "",
    location: visit.location || visit.direccion || client?.address || "",
    estado: visit.estado || client?.estado || "",
    latitude: visit.latitude ?? visit.lat ?? null,
    longitude: visit.longitude ?? visit.lng ?? null,
    photoUri: visit.photoUri || visit.foto || "",
    notes: visit.notes || visit.nota || "",
    followUp: visit.followUp || "none",
    createdAt,
    fecha: date,
    scheduledDate: visit.scheduledDate || (status === "Programada" ? date : ""),
    startAt,
    endAt,
    hora: visit.hora || (startAt ? formatTime(startAt) : ""),
    horaFin: endAt ? formatTime(endAt) : "",
    vendedorId: visit.vendedorId || loadSellerId(),
    vendedor: visit.vendedor || getSeller(visit.vendedorId).name,
    ruta: visit.ruta || getSeller(visit.vendedorId).ruta,
  };
}

function makeOrderCode(date = new Date()) {
  const stamp = todayISO().replaceAll("-", "");
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  return `OV-${stamp}-${hh}${mm}-${rand}`;
}

function normalizeOrder(order) {
  const createdAt = order.createdAt || new Date().toISOString();
  const lines = normalizeLines(order.lines, order.priceList || "list");
  const clientId = order.clientId || resolveClientId({ client: order.client, clientId: order.clientId });
  const client = getClient(clientId);
  const status = order.status || "Confirmada";
  const createdDate = new Date(createdAt);

  return {
    id: order.id || uid("ord"),
    code: order.code || makeOrderCode(Number.isNaN(createdDate.getTime()) ? new Date() : createdDate),
    clientId,
    clientName: client?.name || order.client || "",
    vendedorId: order.vendedorId || loadSellerId(),
    vendedor: order.vendedor || getSeller(order.vendedorId).name,
    ruta: order.ruta || getSeller(order.vendedorId).ruta,
    visitId: order.visitId || "",
    status,
    lines,
    amount: linesTotal(lines) || Number(order.amount || 0),
    priceList: order.priceList || "list",
    notes: order.notes || "",
    createdAt,
    fecha: order.fecha || createdAt.slice(0, 10),
  };
}

function loadVisits() {
  migrateLegacyIfNeeded();
  return loadJson(VISITS_KEY).map(normalizeVisit);
}

function saveVisits(visits) {
  saveJson(VISITS_KEY, visits.map(normalizeVisit));
}

function loadOrders() {
  migrateLegacyIfNeeded();
  return loadJson(ORDERS_KEY).map(normalizeOrder);
}

function saveOrders(orders) {
  saveJson(ORDERS_KEY, orders.map(normalizeOrder));
}

function upsertVisit(visit) {
  const visits = loadVisits();
  const normalized = normalizeVisit(visit);
  const index = visits.findIndex((item) => item.id === normalized.id);
  if (index >= 0) visits[index] = normalized;
  else visits.push(normalized);
  saveVisits(visits);
  return normalized;
}

function upsertOrder(order) {
  const orders = loadOrders();
  const normalized = normalizeOrder(order);
  const index = orders.findIndex((item) => item.id === normalized.id);
  if (index >= 0) orders[index] = normalized;
  else orders.push(normalized);
  saveOrders(orders);
  return normalized;
}

function ordersForVisit(visitId) {
  return loadOrders().filter((order) => order.visitId === visitId);
}

function clearDemoData() {
  localStorage.removeItem(VISITS_KEY);
  localStorage.removeItem(ORDERS_KEY);
  localStorage.removeItem(CLIENTS_KEY);
  localStorage.removeItem(MIGRATED_KEY);
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

function motiveLabel(id) {
  return VISIT_MOTIVES.find((item) => item.id === id)?.label || "";
}

function followUpLabel(id) {
  return FOLLOW_UPS.find((item) => item.id === id)?.label || "";
}

function summarizeVisits(visits, orders = loadOrders()) {
  const completed = completedVisits(visits);
  const visitIds = new Set(visits.map((visit) => visit.id));
  const sellerIds = new Set(visits.map((visit) => visit.vendedorId));
  const relatedOrders = orders.filter((order) =>
    (order.visitId && visitIds.has(order.visitId)) ||
    sellerIds.has(order.vendedorId)
  );
  const scopedOrders = orders.filter((order) => {
    if (!visits.length) return true;
    if (order.visitId && visitIds.has(order.visitId)) return true;
    return sellerIds.has(order.vendedorId);
  });
  const sales = scopedOrders.reduce((sum, order) => sum + Number(order.amount || 0), 0);
  const withSale = completed.filter((visit) => visit.outcome === "con_venta").length;
  const none = completed.filter((visit) => visit.outcome === "sin_venta").length;
  return {
    visits: completed.length,
    sales,
    closed: withSale,
    partial: relatedOrders.filter((order) => order.status === "Parcial").length,
    none,
    withSale,
    orders: scopedOrders.length,
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
  if (visit.outcome === "con_venta") return { text: "Con venta", className: "badge badge-success" };
  if (visit.outcome === "sin_venta") return { text: "Sin venta", className: "badge badge-muted" };
  return { text: "Completada", className: "badge badge-muted" };
}

function badgeForOrder(order) {
  if (order.status === "Borrador") return { text: "Borrador", className: "badge badge-muted" };
  if (order.status === "Parcial") return { text: "Parcial", className: "badge badge-partial" };
  return { text: "Confirmada", className: "badge badge-success" };
}

function renderVisitCard(visit, interactive = false) {
  const badge = badgeForVisit(visit);
  const client = getClient(visit.clientId);
  const timeRange = [
    visit.hora || (visit.startAt ? formatTime(visit.startAt) : ""),
    visit.horaFin || (visit.endAt ? formatTime(visit.endAt) : ""),
  ].filter(Boolean).join(" – ");
  const metaParts = [
    client?.rif || visit.estado || visit.location,
    visit.status === "Programada" ? formatDateShort(visit.fecha) : timeRange || visit.hora,
  ].filter(Boolean);
  const motive = visit.motive ? `<p class="meta">Motivo: ${escapeHtml(motiveLabel(visit.motive))}</p>` : "";
  const follow = visit.followUp && visit.followUp !== "none"
    ? `<p class="meta follow-line">Seguimiento: ${escapeHtml(followUpLabel(visit.followUp))}</p>`
    : "";
  const iconPath = visit.status === "Programada"
    ? '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>'
    : visit.status === "En curso"
      ? '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'
      : '<path d="M20 6L9 17l-5-5"/>';
  const tag = interactive ? "button" : "article";
  const typeAttr = interactive ? ' type="button"' : "";

  return `
    <${tag} class="visit-card${interactive ? " visit-card-btn" : ""}" data-id="${escapeHtml(visit.id)}"${typeAttr}>
      <div class="visit-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2">${iconPath}</svg>
      </div>
      <div class="visit-body">
        <div class="visit-row">
          <h3>${escapeHtml(visit.clientName || clientLabel(visit.clientId))}</h3>
          <span class="${badge.className}">${escapeHtml(badge.text)}</span>
        </div>
        <p class="meta">${escapeHtml(metaParts.join(" · "))}</p>
        ${motive}
        ${follow}
        <div class="visit-footer">
          <p class="notes">${escapeHtml(visit.notes || (visit.status === "Programada" ? "En agenda" : "Sin observaciones"))}</p>
        </div>
      </div>
    </${tag}>
  `;
}

function renderOrderCard(order) {
  const badge = badgeForOrder(order);
  const client = getClient(order.clientId);
  const linesLabel = order.lines?.length
    ? order.lines.map((line) => `${line.qty}× ${line.name}`).join(" · ")
    : "Sin ítems";
  const visitNote = order.visitId ? "Con visita" : "Sin visita";
  return `
    <article class="visit-card sales-card" data-order-id="${escapeHtml(order.id)}">
      <div class="visit-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M6 6h15l-1.5 9h-12z"/><circle cx="9" cy="20" r="1"/><circle cx="18" cy="20" r="1"/><path d="M6 6 5 3H2"/>
        </svg>
      </div>
      <div class="visit-body">
        <div class="visit-row">
          <h3>${escapeHtml(order.code || "Orden")}</h3>
          <span class="${badge.className}">${escapeHtml(badge.text)}</span>
        </div>
        <p class="meta">${escapeHtml(order.clientName || clientLabel(order.clientId))}${client?.rif ? ` · ${escapeHtml(client.rif)}` : ""}</p>
        <p class="meta products-line">${escapeHtml(linesLabel)}</p>
        <p class="meta">${escapeHtml(formatDateShort(order.fecha))} · ${escapeHtml(formatTime(order.createdAt))} · ${visitNote}</p>
        <div class="visit-footer">
          <p class="notes">${escapeHtml(order.notes || "Orden de venta")}</p>
          <strong class="visit-amount">$${formatCurrency(order.amount)}</strong>
        </div>
      </div>
    </article>
  `;
}

function renderLinkedOrderRow(order) {
  const badge = badgeForOrder(order);
  const items = order.lines?.length || 0;
  return `
    <div class="linked-order-row">
      <div>
        <strong>${escapeHtml(order.code || "Orden")}</strong>
        <p>${items} ítem${items === 1 ? "" : "s"} · ${escapeHtml(order.status)}</p>
      </div>
      <div class="linked-order-right">
        <span class="${badge.className}">$${formatCurrency(order.amount)}</span>
      </div>
    </div>
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

function migrateLegacyIfNeeded() {
  if (localStorage.getItem(MIGRATED_KEY) === "1") return;
  ensureClientsSeeded();

  let rawVisits = [];
  try {
    rawVisits = JSON.parse(localStorage.getItem(VISITS_KEY) || "[]");
    if (!Array.isArray(rawVisits)) rawVisits = [];
  } catch (error) {
    rawVisits = [];
  }

  const orders = loadJson(ORDERS_KEY);
  const cleanedVisits = [];

  rawVisits.forEach((raw) => {
    if (raw.saleOnly) {
      orders.push(normalizeOrder({
        clientId: resolveClientId(raw),
        client: raw.client,
        vendedorId: raw.vendedorId,
        vendedor: raw.vendedor,
        ruta: raw.ruta,
        lines: raw.lines,
        amount: raw.amount,
        notes: raw.notes,
        createdAt: raw.createdAt,
        status: raw.result === "Venta parcial" ? "Parcial" : "Confirmada",
      }));
      return;
    }

    const visit = normalizeVisit(raw);
    cleanedVisits.push(visit);

    if (Array.isArray(raw.lines) && raw.lines.length) {
      orders.push(normalizeOrder({
        clientId: visit.clientId,
        vendedorId: visit.vendedorId,
        vendedor: visit.vendedor,
        ruta: visit.ruta,
        visitId: visit.id,
        lines: raw.lines,
        amount: raw.amount,
        notes: raw.notes,
        createdAt: raw.createdAt,
        status: raw.result === "Venta parcial" ? "Parcial" : "Confirmada",
      }));
    }
  });

  saveVisits(cleanedVisits);
  saveOrders(orders);
  localStorage.setItem(MIGRATED_KEY, "1");
}

function seedDemoData() {
  ensureClientsSeeded();
  const now = new Date();
  const marina = SELLERS[0];
  const luis = SELLERS[1];
  const carlos = SELLERS[2];
  const ana = SELLERS[3];
  const tomorrow = addDaysISO(todayISO(), 1);
  const clients = loadClients();

  const visits = [
    normalizeVisit({
      status: "Completada",
      clientId: clients[1].id,
      outcome: "con_venta",
      motive: "rutina",
      location: clients[1].address,
      estado: clients[1].estado,
      notes: "Cliente pidió catálogo. Quedó en confirmar el resto.",
      followUp: "call",
      createdAt: new Date(now.getTime() - 35 * 60000).toISOString(),
      startAt: new Date(now.getTime() - 50 * 60000).toISOString(),
      endAt: new Date(now.getTime() - 35 * 60000).toISOString(),
      vendedorId: marina.id,
      vendedor: marina.name,
      ruta: marina.ruta,
    }),
    normalizeVisit({
      status: "En curso",
      clientId: clients[0].id,
      location: clients[0].address,
      estado: clients[0].estado,
      notes: "Check-in hecho. Negociando pedido.",
      createdAt: new Date(now.getTime() - 20 * 60000).toISOString(),
      startAt: new Date(now.getTime() - 20 * 60000).toISOString(),
      vendedorId: marina.id,
      vendedor: marina.name,
      ruta: marina.ruta,
    }),
    normalizeVisit({
      status: "Programada",
      clientId: clients[2].id,
      scheduledDate: tomorrow,
      fecha: tomorrow,
      estado: clients[2].estado,
      location: clients[2].address,
      notes: "Llevar promoción de Cola Zero.",
      createdAt: now.toISOString(),
      vendedorId: marina.id,
      vendedor: marina.name,
      ruta: marina.ruta,
    }),
    normalizeVisit({
      status: "Completada",
      clientId: clients[4].id,
      outcome: "con_venta",
      motive: "nuevos",
      estado: clients[4].estado,
      notes: "Pedido completo entregado.",
      createdAt: new Date(now.getTime() - 50 * 60000).toISOString(),
      startAt: new Date(now.getTime() - 70 * 60000).toISOString(),
      endAt: new Date(now.getTime() - 50 * 60000).toISOString(),
      vendedorId: luis.id,
      vendedor: luis.name,
      ruta: luis.ruta,
    }),
    normalizeVisit({
      status: "Completada",
      clientId: clients[3].id,
      outcome: "sin_venta",
      motive: "negociar",
      estado: clients[3].estado,
      location: clients[3].address,
      notes: "Cliente pidió tiempo para revisar precios.",
      createdAt: new Date(now.getTime() - 90 * 60000).toISOString(),
      startAt: new Date(now.getTime() - 110 * 60000).toISOString(),
      endAt: new Date(now.getTime() - 90 * 60000).toISOString(),
      vendedorId: ana.id,
      vendedor: ana.name,
      ruta: ana.ruta,
    }),
  ];

  const orders = [
    normalizeOrder({
      clientId: clients[1].id,
      visitId: visits[0].id,
      vendedorId: marina.id,
      vendedor: marina.name,
      ruta: marina.ruta,
      lines: [{ productId: "cola1", qty: 5 }, { productId: "leche1", qty: 8 }],
      status: "Parcial",
      notes: "Pedido parcial de la visita.",
      createdAt: visits[0].endAt,
    }),
    normalizeOrder({
      clientId: clients[4].id,
      visitId: visits[3].id,
      vendedorId: luis.id,
      vendedor: luis.name,
      ruta: luis.ruta,
      lines: [{ productId: "cola2", qty: 20 }, { productId: "cola1", qty: 10 }],
      status: "Confirmada",
      notes: "Pedido completo.",
      createdAt: visits[3].endAt,
    }),
    normalizeOrder({
      clientId: clients[5].id,
      vendedorId: carlos.id,
      vendedor: carlos.name,
      ruta: carlos.ruta,
      lines: [{ productId: "leche2", qty: 40 }, { productId: "cola2", qty: 18 }],
      status: "Confirmada",
      notes: "Orden sin visita presencial.",
      createdAt: new Date(now.getTime() - 70 * 60000).toISOString(),
    }),
    normalizeOrder({
      clientId: clients[3].id,
      vendedorId: ana.id,
      vendedor: ana.name,
      ruta: ana.ruta,
      lines: [{ productId: "agua", qty: 24 }, { productId: "yogurt", qty: 6 }],
      status: "Confirmada",
      notes: "Pedido de prueba ruta sur.",
      createdAt: new Date(now.getTime() - 40 * 60000).toISOString(),
    }),
  ];

  saveVisits(visits);
  saveOrders(orders);
  localStorage.setItem(MIGRATED_KEY, "1");
  return { visits, orders };
}

// Back-compat aliases used by older call sites
const STORAGE_KEY = VISITS_KEY;
function clearVisits() {
  clearDemoData();
}
function seedDemoVisits() {
  return seedDemoData().visits;
}
function isSale(result) {
  return result === "con_venta" || result === "Con venta" || result === "Venta cerrada" || result === "Venta parcial";
}
