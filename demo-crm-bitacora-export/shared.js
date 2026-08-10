const STORAGE_KEY = "demo_crm_visitas";

const SELLERS = [
  { id: "luis", name: "Luis Rojas", ruta: "Ruta Centro · Lara" },
  { id: "maria", name: "María Gutiérrez", ruta: "Ruta Norte · Carabobo" },
  { id: "carlos", name: "Carlos Pérez", ruta: "Ruta Este · Capital" },
];

const ESTADOS = ["Lara", "Carabobo", "Yaracuy", "Aragua", "Distrito Capital"];
const RESULTADOS = ["Venta cerrada", "Venta parcial", "Pedido para mañana", "Sin venta"];

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

function normalizeVisit(visit) {
  const seller = SELLERS.find((item) => item.name === visit.vendedor) || SELLERS[0];
  return {
    id: visit.id || `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    cliente: visit.cliente || "",
    estado: visit.estado || "",
    resultado: visit.resultado || "",
    monto: Number(visit.monto || 0),
    direccion: visit.direccion || "",
    lat: visit.lat == null || visit.lat === "" ? null : Number(visit.lat),
    lng: visit.lng == null || visit.lng === "" ? null : Number(visit.lng),
    foto: visit.foto || "",
    nota: visit.nota || "",
    hora: visit.hora || "",
    fecha: visit.fecha || todayISO(),
    vendedor: visit.vendedor || seller.name,
    ruta: visit.ruta || seller.ruta,
  };
}

function todayISO() {
  const now = new Date();
  const offset = now.getTimezoneOffset();
  const local = new Date(now.getTime() - offset * 60000);
  return local.toISOString().slice(0, 10);
}

function formatCurrency(value) {
  return Number(value || 0).toLocaleString("es-VE", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

function formatDateLabel(isoDate) {
  if (!isoDate) return "";
  const [year, month, day] = isoDate.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString("es-VE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function mapsUrl(lat, lng, direccion) {
  if (lat && lng) {
    return `https://www.google.com/maps?q=${encodeURIComponent(`${lat},${lng}`)}`;
  }
  if (direccion) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(direccion)}`;
  }
  return "";
}

function isSuccessfulVisit(visit) {
  return visit.resultado && visit.resultado !== "Sin venta";
}

function summarizeVisits(visits) {
  const totalSales = visits.reduce((sum, visit) => sum + Number(visit.monto || 0), 0);
  const successful = visits.filter(isSuccessfulVisit).length;
  return {
    visits: visits.length,
    sales: totalSales,
    successful,
    effectiveness: visits.length ? Math.round((successful / visits.length) * 100) : 0,
    pending: totalSales * 0.3,
  };
}

function filterVisits(visits, filters = {}) {
  return visits.filter((visit) => {
    if (filters.fecha && visit.fecha !== filters.fecha) return false;
    if (filters.estado && visit.estado !== filters.estado) return false;
    if (filters.resultado && visit.resultado !== filters.resultado) return false;
    if (filters.vendedor && visit.vendedor !== filters.vendedor) return false;
    if (filters.ruta && visit.ruta !== filters.ruta) return false;
    return true;
  });
}

function groupBySeller(visits) {
  const bySeller = new Map();

  visits.forEach((visit) => {
    const name = visit.vendedor || "Sin asignar";
    if (!bySeller.has(name)) {
      const seller = SELLERS.find((item) => item.name === name);
      bySeller.set(name, {
        name,
        ruta: visit.ruta || seller?.ruta || "Sin ruta",
        visits: [],
      });
    }
    bySeller.get(name).visits.push(visit);
  });

  return [...bySeller.values()]
    .map((seller) => ({
      ...seller,
      ...summarizeVisits(seller.visits),
    }))
    .sort((a, b) => b.sales - a.sales);
}

function renderVisitItem(visit, { showSeller = false } = {}) {
  const mapLink = mapsUrl(visit.lat, visit.lng, visit.direccion);
  const locationLabel = visit.direccion
    || (visit.lat && visit.lng ? `${Number(visit.lat).toFixed(5)}, ${Number(visit.lng).toFixed(5)}` : "");

  return `
    <li class="item">
      <div class="item-top">
        <strong>${escapeHtml(visit.cliente)}</strong>
        <span class="badge">${escapeHtml(visit.resultado)}</span>
      </div>
      <p>
        ${showSeller ? `${escapeHtml(visit.vendedor)} · ` : ""}
        ${escapeHtml(visit.estado)} · ${escapeHtml(formatDateLabel(visit.fecha))} ${escapeHtml(visit.hora)}
        · Venta USD $ ${formatCurrency(visit.monto)}
      </p>
      <p class="meta">${escapeHtml(visit.ruta || "Sin ruta")}</p>
      ${locationLabel ? `
        <p class="location">
          ${mapLink ? `<a href="${mapLink}" target="_blank" rel="noopener noreferrer">${escapeHtml(locationLabel)}</a>` : escapeHtml(locationLabel)}
        </p>
      ` : ""}
      ${visit.nota ? `<p>Nota: ${escapeHtml(visit.nota)}</p>` : ""}
      ${visit.foto ? `<img class="visit-foto" src="${visit.foto}" alt="Foto de ${escapeHtml(visit.cliente)}">` : ""}
    </li>
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
        const width = Math.round(img.width * scale);
        const height = Math.round(img.height * scale);
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

async function reverseGeocode(lat, lng) {
  const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lng)}&zoom=18&addressdetails=1`;
  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
    },
  });
  if (!response.ok) throw new Error("Geocoding falló");
  const data = await response.json();
  return data.display_name || `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
}

function seedDemoVisits() {
  const today = todayISO();
  const yesterdayDate = new Date();
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  const offset = yesterdayDate.getTimezoneOffset();
  const yesterday = new Date(yesterdayDate.getTime() - offset * 60000).toISOString().slice(0, 10);

  const samples = [
    {
      cliente: "Farmacia Central",
      estado: "Lara",
      resultado: "Venta cerrada",
      monto: 420,
      direccion: "Av. 20, Barquisimeto, Lara",
      lat: 10.0739,
      lng: -69.3224,
      nota: "Pedido completo entregado",
      hora: "09:20",
      fecha: today,
      vendedor: "Luis Rojas",
      ruta: "Ruta Centro · Lara",
    },
    {
      cliente: "Mini Market Los Cedros",
      estado: "Lara",
      resultado: "Venta parcial",
      monto: 180,
      direccion: "Calle 24 con Carrera 19, Barquisimeto",
      lat: 10.0672,
      lng: -69.3181,
      nota: "Reponer stock mañana",
      hora: "11:05",
      fecha: today,
      vendedor: "Luis Rojas",
      ruta: "Ruta Centro · Lara",
    },
    {
      cliente: "Bodega El Sol",
      estado: "Carabobo",
      resultado: "Pedido para mañana",
      monto: 260,
      direccion: "Av. Bolívar Norte, Valencia",
      lat: 10.183,
      lng: -68.002,
      nota: "Confirmar horario de descarga",
      hora: "10:40",
      fecha: today,
      vendedor: "María Gutiérrez",
      ruta: "Ruta Norte · Carabobo",
    },
    {
      cliente: "Abastos La Esperanza",
      estado: "Carabobo",
      resultado: "Sin venta",
      monto: 0,
      direccion: "Calle Paez, Naguanagua",
      lat: 10.219,
      lng: -68.007,
      nota: "Cliente sin presupuesto hoy",
      hora: "13:15",
      fecha: yesterday,
      vendedor: "María Gutiérrez",
      ruta: "Ruta Norte · Carabobo",
    },
    {
      cliente: "Supermercado Plaza",
      estado: "Distrito Capital",
      resultado: "Venta cerrada",
      monto: 610,
      direccion: "Av. Lecuna, Caracas",
      lat: 10.496,
      lng: -66.898,
      nota: "Incluye promoción semanal",
      hora: "08:50",
      fecha: today,
      vendedor: "Carlos Pérez",
      ruta: "Ruta Este · Capital",
    },
    {
      cliente: "Kiosco 24h",
      estado: "Distrito Capital",
      resultado: "Venta parcial",
      monto: 95,
      direccion: "Chacao, Caracas",
      lat: 10.495,
      lng: -66.853,
      nota: "Solo bebidas",
      hora: "16:10",
      fecha: yesterday,
      vendedor: "Carlos Pérez",
      ruta: "Ruta Este · Capital",
    },
  ].map(normalizeVisit);

  saveVisits(samples);
  return samples;
}
