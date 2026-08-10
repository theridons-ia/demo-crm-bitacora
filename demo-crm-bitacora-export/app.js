const STORAGE_KEY = "demo_crm_visitas";

const form = document.getElementById("visit-form");
const visitsList = document.getElementById("visits-list");
const clearBtn = document.getElementById("clear-btn");
const gpsBtn = document.getElementById("gps-btn");
const fotoInput = document.getElementById("foto");
const fotoPreview = document.getElementById("foto-preview");
const direccionInput = document.getElementById("direccion");
const latInput = document.getElementById("lat");
const lngInput = document.getElementById("lng");
const gpsStatus = document.getElementById("gps-status");

const kpiVisitas = document.getElementById("kpi-visitas");
const kpiVentas = document.getElementById("kpi-ventas");
const kpiEfectividad = document.getElementById("kpi-efectividad");
const pendienteCobro = document.getElementById("pendiente-cobro");

let pendingFoto = "";

function loadVisits() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (error) {
    return [];
  }
}

function saveVisits(visits) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(visits));
}

function formatCurrency(value) {
  return Number(value || 0).toLocaleString("es-VE", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
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

function setGpsStatus(message, isError = false) {
  gpsStatus.textContent = message;
  gpsStatus.classList.toggle("error", isError);
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

function renderLeaderboard(visits) {
  const leaderboard = document.getElementById("leaderboard");
  const bySeller = new Map();

  // Reparto simple para demo: alterna 3 vendedores.
  const sellers = ["Luis Rojas", "María Gutiérrez", "Carlos Pérez"];
  visits.forEach((visit, index) => {
    const name = sellers[index % sellers.length];
    if (!bySeller.has(name)) bySeller.set(name, { visits: 0, sales: 0, wins: 0 });
    const row = bySeller.get(name);
    row.visits += 1;
    row.sales += Number(visit.monto || 0);
    if (visit.resultado !== "Sin venta") row.wins += 1;
  });

  const ordered = [...bySeller.entries()]
    .map(([name, stats]) => ({
      name,
      ...stats,
      effectiveness: stats.visits ? Math.round((stats.wins / stats.visits) * 100) : 0,
    }))
    .sort((a, b) => b.sales - a.sales);

  if (!ordered.length) {
    leaderboard.innerHTML = '<p class="empty">Aún no hay datos de vendedores en la demo.</p>';
    return;
  }

  leaderboard.innerHTML = ordered
    .map((seller) => `
      <li class="item">
        <div class="item-top">
          <strong>${escapeHtml(seller.name)}</strong>
          <strong>$ ${formatCurrency(seller.sales)}</strong>
        </div>
        <p>${seller.visits} visitas · ${seller.effectiveness}% efectividad</p>
      </li>
    `)
    .join("");
}

function renderVisits() {
  const visits = loadVisits();
  const totalSales = visits.reduce((sum, visit) => sum + Number(visit.monto || 0), 0);
  const successful = visits.filter((visit) => visit.resultado !== "Sin venta").length;
  const effectiveness = visits.length ? Math.round((successful / visits.length) * 100) : 0;

  kpiVisitas.textContent = visits.length;
  kpiVentas.textContent = `$ ${formatCurrency(totalSales)}`;
  kpiEfectividad.textContent = `${effectiveness}%`;
  // Supuesto simple: 30% de lo vendido queda por cobrar.
  pendienteCobro.textContent = `Cobranza pendiente: $ ${formatCurrency(totalSales * 0.3)}`;

  if (!visits.length) {
    visitsList.innerHTML = '<p class="empty">No hay visitas cargadas todavía.</p>';
    renderLeaderboard(visits);
    return;
  }

  visitsList.innerHTML = visits
    .slice()
    .reverse()
    .map((visit) => {
      const mapLink = mapsUrl(visit.lat, visit.lng, visit.direccion);
      const locationLabel = visit.direccion
        || (visit.lat && visit.lng ? `${Number(visit.lat).toFixed(5)}, ${Number(visit.lng).toFixed(5)}` : "");

      return `
      <li class="item">
        <div class="item-top">
          <strong>${escapeHtml(visit.cliente)}</strong>
          <span class="badge">${escapeHtml(visit.resultado)}</span>
        </div>
        <p>${escapeHtml(visit.estado)} · ${escapeHtml(visit.hora)} · Venta USD $ ${formatCurrency(visit.monto)}</p>
        ${locationLabel ? `
          <p class="location">
            ${mapLink ? `<a href="${mapLink}" target="_blank" rel="noopener noreferrer">${escapeHtml(locationLabel)}</a>` : escapeHtml(locationLabel)}
          </p>
        ` : ""}
        ${visit.nota ? `<p>Nota: ${escapeHtml(visit.nota)}</p>` : ""}
        ${visit.foto ? `<img class="visit-foto" src="${visit.foto}" alt="Foto de ${escapeHtml(visit.cliente)}">` : ""}
      </li>
    `;
    })
    .join("");

  renderLeaderboard(visits);
}

function clearFotoPreview() {
  pendingFoto = "";
  fotoPreview.innerHTML = "";
  fotoPreview.classList.add("hidden");
  fotoInput.value = "";
}

gpsBtn.addEventListener("click", () => {
  if (!navigator.geolocation) {
    setGpsStatus("Este dispositivo no soporta GPS.", true);
    return;
  }

  gpsBtn.disabled = true;
  setGpsStatus("Obteniendo ubicación…");

  navigator.geolocation.getCurrentPosition(
    async (position) => {
      const { latitude, longitude, accuracy } = position.coords;
      latInput.value = String(latitude);
      lngInput.value = String(longitude);

      try {
        const address = await reverseGeocode(latitude, longitude);
        direccionInput.value = address;
        setGpsStatus(`Ubicación capturada (±${Math.round(accuracy)} m).`);
      } catch (error) {
        direccionInput.value = `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
        setGpsStatus(`Coordenadas capturadas (±${Math.round(accuracy)} m). Puedes editar la dirección.`);
      } finally {
        gpsBtn.disabled = false;
      }
    },
    (error) => {
      gpsBtn.disabled = false;
      const messages = {
        1: "Permiso de ubicación denegado. Actívalo en el navegador.",
        2: "No se pudo obtener la ubicación. Revisa el GPS.",
        3: "Tiempo de espera agotado al pedir la ubicación.",
      };
      setGpsStatus(messages[error.code] || "Error al capturar GPS.", true);
    },
    {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 0,
    }
  );
});

fotoInput.addEventListener("change", async () => {
  const file = fotoInput.files && fotoInput.files[0];
  if (!file) {
    clearFotoPreview();
    return;
  }

  try {
    pendingFoto = await compressImage(file);
    fotoPreview.innerHTML = `
      <img src="${pendingFoto}" alt="Vista previa del establecimiento">
      <button type="button" class="ghost" id="remove-foto">Quitar foto</button>
    `;
    fotoPreview.classList.remove("hidden");
    document.getElementById("remove-foto").addEventListener("click", clearFotoPreview);
  } catch (error) {
    clearFotoPreview();
    alert("No se pudo procesar la foto. Prueba con otra imagen.");
  }
});

form.addEventListener("submit", (event) => {
  event.preventDefault();
  const formData = new FormData(form);

  const newVisit = {
    cliente: String(formData.get("cliente") || "").trim(),
    estado: String(formData.get("estado") || ""),
    resultado: String(formData.get("resultado") || ""),
    monto: Number(formData.get("monto") || 0),
    direccion: String(formData.get("direccion") || "").trim(),
    lat: formData.get("lat") ? Number(formData.get("lat")) : null,
    lng: formData.get("lng") ? Number(formData.get("lng")) : null,
    foto: pendingFoto || "",
    nota: String(formData.get("nota") || "").trim(),
    hora: new Date().toLocaleTimeString("es-VE", { hour: "2-digit", minute: "2-digit" }),
  };

  const visits = loadVisits();
  visits.push(newVisit);
  saveVisits(visits);
  form.reset();
  latInput.value = "";
  lngInput.value = "";
  clearFotoPreview();
  setGpsStatus("Usa el GPS del teléfono para registrar dónde estás.");
  renderVisits();
});

clearBtn.addEventListener("click", () => {
  localStorage.removeItem(STORAGE_KEY);
  renderVisits();
});

renderVisits();
