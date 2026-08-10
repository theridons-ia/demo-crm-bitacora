const screens = {
  home: document.getElementById("screen-home"),
  visits: document.getElementById("screen-visits"),
  insights: document.getElementById("screen-insights"),
};

const formScreen = document.getElementById("screen-form");
const tabButtons = [...document.querySelectorAll(".tab")];
const sellerSheet = document.getElementById("seller-sheet");
const sellerOptions = document.getElementById("seller-options");
const homeAvatar = document.getElementById("home-avatar");
const searchInput = document.getElementById("search-input");
const form = document.getElementById("visit-form");
const gpsBtn = document.getElementById("gps-btn");
const photoInput = document.getElementById("photo");
const photoPreview = document.getElementById("photo-preview");
const gpsStatus = document.getElementById("gps-status");
const estadoSelect = document.getElementById("estado");
const clientError = document.getElementById("client-error");

let currentTab = "home";
let resultFilter = "all";
let selectedStatus = "Visitado";
let selectedResult = "Venta cerrada";
let pendingPhoto = "";

function firstName(fullName) {
  return String(fullName || "").split(" ")[0] || "vendedor";
}

function setSegmentGroup(groupId, value) {
  document.querySelectorAll(`#${groupId} .segment`).forEach((button) => {
    button.classList.toggle("active", button.dataset.value === value);
  });
}

function openForm() {
  formScreen.classList.remove("hidden");
  document.querySelector(".tabbar").style.display = "none";
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function closeForm() {
  formScreen.classList.add("hidden");
  document.querySelector(".tabbar").style.display = "";
}

function switchTab(tab) {
  currentTab = tab;
  closeForm();
  Object.entries(screens).forEach(([key, node]) => {
    node.classList.toggle("active", key === tab);
  });
  tabButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.tab === tab);
  });
  render();
}

function getSellerVisits() {
  const seller = getSeller();
  return loadVisits()
    .filter((visit) => visit.vendedorId === seller.id)
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
}

function filteredVisits(visits) {
  const query = searchInput.value.trim().toLowerCase();
  return visits.filter((visit) => {
    if (resultFilter === "sale" && !isSale(visit.result)) return false;
    if (resultFilter === "partial" && visit.result !== "Venta parcial") return false;
    if (resultFilter === "none" && visit.result !== "Sin venta") return false;
    if (!query) return true;
    const haystack = `${visit.client} ${visit.location} ${visit.estado} ${visit.notes}`.toLowerCase();
    return haystack.includes(query);
  });
}

function renderEmpty(message, actionLabel) {
  return `
    <div class="empty">
      <div class="empty-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/>
          <rect x="9" y="3" width="6" height="4" rx="1"/>
        </svg>
      </div>
      <h3>Tu bitácora está lista</h3>
      <p>${escapeHtml(message)}</p>
      <button class="primary-btn" type="button" data-empty-action="register">${escapeHtml(actionLabel)}</button>
    </div>
  `;
}

function bindEmptyActions(container) {
  container.querySelectorAll("[data-empty-action='register']").forEach((button) => {
    button.addEventListener("click", openForm);
  });
}

function renderHome(visits) {
  const seller = getSeller();
  const today = visitsToday(visits);
  const summary = summarizeVisits(today);

  document.getElementById("home-date").textContent = formatDateLong();
  document.getElementById("home-greeting").textContent = `Hola, ${firstName(seller.name)}`;
  document.getElementById("home-avatar").textContent = seller.initials;
  document.getElementById("route-title").textContent =
    summary.visits ? `${seller.ruta}` : "Tu ruta comienza aquí";
  document.getElementById("route-progress").style.width = `${summary.goalProgress}%`;
  document.getElementById("route-count").textContent =
    `${summary.visits} de ${DAILY_GOAL} visitas registradas`;
  document.getElementById("route-percent").textContent = `${summary.goalProgress}%`;
  document.getElementById("metric-visits").textContent = summary.visits;
  document.getElementById("metric-sales").textContent = `$${formatCurrency(summary.sales)}`;
  document.getElementById("metric-effectiveness").textContent = `${summary.effectiveness}%`;

  const recent = document.getElementById("recent-list");
  if (!visits.length) {
    recent.innerHTML = renderEmpty(
      "Registra tu primera visita para ver la actividad reciente.",
      "Registrar primera visita"
    );
    bindEmptyActions(recent);
    return;
  }

  recent.innerHTML = visits.slice(0, 3).map((visit) => renderVisitCard(visit)).join("");
}

function renderVisits(visits) {
  const list = document.getElementById("visits-list");
  const filtered = filteredVisits(visits);
  document.getElementById("visits-count").textContent =
    `${visits.length} registro${visits.length === 1 ? "" : "s"} guardado${visits.length === 1 ? "" : "s"} en el dispositivo`;

  if (!visits.length) {
    list.innerHTML = renderEmpty(
      "Aún no hay visitas guardadas en este dispositivo.",
      "Registrar primera visita"
    );
    bindEmptyActions(list);
    return;
  }

  if (!filtered.length) {
    list.innerHTML = `
      <div class="empty">
        <div class="empty-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>
          </svg>
        </div>
        <h3>Sin coincidencias</h3>
        <p>Prueba otra búsqueda o limpia el filtro activo.</p>
      </div>
    `;
    return;
  }

  list.innerHTML = filtered.map((visit) => renderVisitCard(visit)).join("");
}

function renderInsights(visits) {
  const today = visitsToday(visits);
  const all = summarizeVisits(visits);
  const day = summarizeVisits(today);
  const max = Math.max(all.closed, all.partial, all.none, 1);

  document.getElementById("insight-sales").textContent = `$${formatCurrency(all.sales)}`;
  document.getElementById("insight-sales-sub").textContent =
    `en ${all.visits} visita${all.visits === 1 ? "" : "s"} registrada${all.visits === 1 ? "" : "s"}`;
  document.getElementById("count-closed").textContent = all.closed;
  document.getElementById("count-partial").textContent = all.partial;
  document.getElementById("count-none").textContent = all.none;
  document.getElementById("bar-closed").style.width = `${(all.closed / max) * 100}%`;
  document.getElementById("bar-partial").style.width = `${(all.partial / max) * 100}%`;
  document.getElementById("bar-none").style.width = `${(all.none / max) * 100}%`;
  document.getElementById("goal-count").textContent = `${day.visits} / ${DAILY_GOAL}`;
  document.getElementById("goal-ring").style.setProperty("--p", `${day.goalProgress}%`);
  document.getElementById("goal-ring").textContent = `${day.goalProgress}%`;
  document.getElementById("goal-progress").style.width = `${day.goalProgress}%`;
  document.getElementById("goal-tip").textContent = day.remaining
    ? `Te faltan ${day.remaining} visita${day.remaining === 1 ? "" : "s"} para completar el objetivo.`
    : "¡Objetivo diario completado!";
}

function render() {
  const visits = getSellerVisits();
  renderHome(visits);
  renderVisits(visits);
  renderInsights(visits);
}

function clearPhotoPreview() {
  pendingPhoto = "";
  photoPreview.innerHTML = "";
  photoPreview.classList.add("hidden");
  photoInput.value = "";
}

function openSellerSheet() {
  const current = getSeller();
  sellerOptions.innerHTML = SELLERS.map((seller) => `
    <button class="seller-option ${seller.id === current.id ? "active" : ""}" type="button" data-seller="${seller.id}">
      <span class="avatar">${escapeHtml(seller.initials)}</span>
      <span>
        <strong>${escapeHtml(seller.name)}</strong>
        <span>${escapeHtml(seller.ruta)}</span>
      </span>
    </button>
  `).join("");

  sellerOptions.querySelectorAll("[data-seller]").forEach((button) => {
    button.addEventListener("click", () => {
      saveSellerId(button.dataset.seller);
      closeSellerSheet();
      render();
    });
  });

  sellerSheet.classList.remove("hidden");
}

function closeSellerSheet() {
  sellerSheet.classList.add("hidden");
}

function initEstadoSelect() {
  estadoSelect.innerHTML =
    `<option value="">Selecciona un estado</option>` +
    ESTADOS.map((estado) => `<option value="${escapeHtml(estado)}">${escapeHtml(estado)}</option>`).join("");
}

initEstadoSelect();

if (!loadVisits().length) {
  seedDemoVisits();
}

tabButtons.forEach((button) => {
  button.addEventListener("click", () => switchTab(button.dataset.tab));
});

document.getElementById("cta-register").addEventListener("click", openForm);
document.getElementById("visits-add-btn").addEventListener("click", openForm);
document.getElementById("see-all-btn").addEventListener("click", () => switchTab("visits"));
document.getElementById("form-back-btn").addEventListener("click", closeForm);
homeAvatar.addEventListener("click", openSellerSheet);
document.getElementById("seller-sheet-backdrop").addEventListener("click", closeSellerSheet);

searchInput.addEventListener("input", () => renderVisits(getSellerVisits()));

document.querySelectorAll(".chip").forEach((chip) => {
  chip.addEventListener("click", () => {
    resultFilter = chip.dataset.filter;
    document.querySelectorAll(".chip").forEach((node) => {
      node.classList.toggle("active", node === chip);
    });
    renderVisits(getSellerVisits());
  });
});

document.querySelectorAll("#status-group .segment").forEach((button) => {
  button.addEventListener("click", () => {
    selectedStatus = button.dataset.value;
    setSegmentGroup("status-group", selectedStatus);
  });
});

document.querySelectorAll("#result-group .segment").forEach((button) => {
  button.addEventListener("click", () => {
    selectedResult = button.dataset.value;
    setSegmentGroup("result-group", selectedResult);
    if (selectedResult === "Sin venta") {
      document.getElementById("amount").value = "0";
    }
  });
});

document.getElementById("clear-btn").addEventListener("click", () => {
  clearVisits();
  render();
});

gpsBtn.addEventListener("click", () => {
  if (!navigator.geolocation) {
    gpsStatus.textContent = "Este dispositivo no soporta GPS. Escribe la dirección manualmente.";
    gpsStatus.classList.add("error");
    return;
  }

  gpsBtn.disabled = true;
  gpsStatus.textContent = "Obteniendo ubicación…";
  gpsStatus.classList.remove("error");

  navigator.geolocation.getCurrentPosition(
    async (position) => {
      const { latitude, longitude, accuracy } = position.coords;
      document.getElementById("latitude").value = String(latitude);
      document.getElementById("longitude").value = String(longitude);
      try {
        document.getElementById("location").value = await reverseGeocode(latitude, longitude);
        gpsStatus.textContent = `Ubicación capturada (±${Math.round(accuracy)} m).`;
      } catch (error) {
        document.getElementById("location").value = `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
        gpsStatus.textContent = "Coordenadas capturadas. Puedes editar la dirección.";
      } finally {
        gpsBtn.disabled = false;
      }
    },
    (error) => {
      gpsBtn.disabled = false;
      gpsStatus.classList.add("error");
      const messages = {
        1: "Permiso de ubicación denegado. Puedes escribir la dirección manualmente.",
        2: "No se pudo obtener la ubicación. Escribe la dirección.",
        3: "Tiempo de espera agotado. Escribe la dirección.",
      };
      gpsStatus.textContent = messages[error.code] || "Error de GPS. Escribe la dirección.";
    },
    { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
  );
});

photoInput.addEventListener("change", async () => {
  const file = photoInput.files && photoInput.files[0];
  if (!file) {
    clearPhotoPreview();
    return;
  }

  try {
    pendingPhoto = await compressImage(file);
    photoPreview.innerHTML = `
      <img src="${pendingPhoto}" alt="Vista previa del establecimiento">
      <button class="ghost" type="button" id="remove-photo">Quitar foto</button>
    `;
    photoPreview.classList.remove("hidden");
    document.getElementById("remove-photo").addEventListener("click", clearPhotoPreview);
  } catch (error) {
    clearPhotoPreview();
    alert("No se pudo procesar la foto. Prueba con otra imagen.");
  }
});

form.addEventListener("submit", (event) => {
  event.preventDefault();
  const client = document.getElementById("client").value.trim();
  if (!client) {
    clientError.classList.remove("hidden");
    return;
  }
  clientError.classList.add("hidden");

  const seller = getSeller();
  const now = new Date();
  const visit = normalizeVisit({
    client,
    status: selectedStatus,
    result: selectedResult,
    amount: Number(document.getElementById("amount").value || 0),
    location: document.getElementById("location").value.trim(),
    estado: document.getElementById("estado").value,
    latitude: document.getElementById("latitude").value
      ? Number(document.getElementById("latitude").value)
      : null,
    longitude: document.getElementById("longitude").value
      ? Number(document.getElementById("longitude").value)
      : null,
    photoUri: pendingPhoto || "",
    notes: document.getElementById("notes").value.trim(),
    createdAt: now.toISOString(),
    hora: formatTime(now),
    fecha: todayISO(),
    vendedorId: seller.id,
    vendedor: seller.name,
    ruta: seller.ruta,
  });

  const visits = loadVisits();
  visits.push(visit);
  saveVisits(visits);

  form.reset();
  selectedStatus = "Visitado";
  selectedResult = "Venta cerrada";
  setSegmentGroup("status-group", selectedStatus);
  setSegmentGroup("result-group", selectedResult);
  document.getElementById("latitude").value = "";
  document.getElementById("longitude").value = "";
  initEstadoSelect();
  clearPhotoPreview();
  gpsStatus.textContent = "Usa el GPS del teléfono o escribe la dirección.";
  gpsStatus.classList.remove("error");
  closeForm();
  switchTab("visits");
});

render();
