const screens = {
  home: document.getElementById("screen-home"),
  visits: document.getElementById("screen-visits"),
  insights: document.getElementById("screen-insights"),
};

const formScreen = document.getElementById("screen-form");
const actionSheet = document.getElementById("action-sheet");
const sellerSheet = document.getElementById("seller-sheet");
const sellerOptions = document.getElementById("seller-options");
const homeAvatar = document.getElementById("home-avatar");
const searchInput = document.getElementById("search-input");
const calendarPanel = document.getElementById("calendar-panel");
const weekStrip = document.getElementById("week-strip");

const visitForm = document.getElementById("visit-form");
const scheduleForm = document.getElementById("schedule-form");
const saleForm = document.getElementById("sale-form");

const gpsBtn = document.getElementById("gps-btn");
const photoInput = document.getElementById("photo");
const photoPreview = document.getElementById("photo-preview");
const gpsStatus = document.getElementById("gps-status");
const clientError = document.getElementById("client-error");

let currentTab = "home";
let resultFilter = "all";
let calendarDay = todayISO();
let selectedStatus = "Visitado";
let selectedResult = "Venta cerrada";
let saleResult = "Venta cerrada";
let pendingPhoto = "";
let visitQty = Object.fromEntries(PRODUCTS.map((p) => [p.id, 0]));
let saleQty = Object.fromEntries(PRODUCTS.map((p) => [p.id, 0]));

function firstName(fullName) {
  return String(fullName || "").split(" ")[0] || "vendedor";
}

function setSegmentGroup(groupId, value) {
  document.querySelectorAll(`#${groupId} .segment`).forEach((button) => {
    button.classList.toggle("active", button.dataset.value === value);
  });
}

function fillEstadoSelect(select) {
  select.innerHTML =
    `<option value="">Selecciona un estado</option>` +
    ESTADOS.map((estado) => `<option value="${escapeHtml(estado)}">${escapeHtml(estado)}</option>`).join("");
}

function qtyMapTotal(qtyMap) {
  return PRODUCTS.reduce((sum, product) => sum + product.price * Number(qtyMap[product.id] || 0), 0);
}

function qtyMapToLines(qtyMap) {
  return PRODUCTS
    .filter((product) => Number(qtyMap[product.id] || 0) > 0)
    .map((product) => ({
      productId: product.id,
      name: product.name,
      unitPrice: product.price,
      qty: Number(qtyMap[product.id]),
    }));
}

function resetQty(qtyMap) {
  PRODUCTS.forEach((product) => {
    qtyMap[product.id] = 0;
  });
}

function renderProductList(containerId, qtyMap, totalId) {
  const container = document.getElementById(containerId);
  container.innerHTML = PRODUCTS.map((product) => `
    <div class="product-row" data-product="${product.id}">
      <div>
        <strong>${escapeHtml(product.name)}</strong>
        <p>$${formatCurrency(product.price)} / ${escapeHtml(product.unit)}</p>
      </div>
      <div class="stepper">
        <button type="button" data-step="-1" aria-label="Menos">−</button>
        <span>${qtyMap[product.id] || 0}</span>
        <button type="button" data-step="1" aria-label="Más">+</button>
      </div>
    </div>
  `).join("");

  container.querySelectorAll(".product-row").forEach((row) => {
    const productId = row.dataset.product;
    row.querySelectorAll("[data-step]").forEach((button) => {
      button.addEventListener("click", () => {
        const next = Math.max(0, Number(qtyMap[productId] || 0) + Number(button.dataset.step));
        qtyMap[productId] = next;
        renderProductList(containerId, qtyMap, totalId);
      });
    });
  });

  document.getElementById(totalId).textContent = `$${formatCurrency(qtyMapTotal(qtyMap))}`;
}

function syncVisitProductsVisibility() {
  const show = isSale(selectedResult);
  document.getElementById("visit-products-field").classList.toggle("hidden", !show);
  if (show) renderProductList("visit-products", visitQty, "visit-sale-total");
}

function hideAllFormModes() {
  document.querySelectorAll(".form-mode").forEach((form) => form.classList.add("hidden"));
}

function openActionSheet() {
  closeSellerSheet();
  actionSheet.classList.remove("hidden");
}

function closeActionSheet() {
  actionSheet.classList.add("hidden");
}

function openForm(mode = "visit") {
  closeActionSheet();
  hideAllFormModes();
  formScreen.classList.remove("hidden");
  document.querySelector(".tabbar").style.display = "none";

  const titles = {
    visit: ["CERRAR VISITA", "Registrar visita hecha"],
    schedule: ["AGENDA", "Programar visita"],
    sale: ["VENTA", "Registrar venta"],
  };
  const [eyebrow, title] = titles[mode] || titles.visit;
  document.getElementById("form-eyebrow").textContent = eyebrow;
  document.getElementById("form-title").textContent = title;

  if (mode === "visit") {
    visitForm.classList.remove("hidden");
    selectedStatus = "Visitado";
    selectedResult = "Venta cerrada";
    setSegmentGroup("status-group", selectedStatus);
    setSegmentGroup("result-group", selectedResult);
    resetQty(visitQty);
    syncVisitProductsVisibility();
  } else if (mode === "schedule") {
    scheduleForm.classList.remove("hidden");
    document.getElementById("schedule-date").value = calendarDay || addDaysISO(todayISO(), 1);
  } else if (mode === "sale") {
    saleForm.classList.remove("hidden");
    saleResult = "Venta cerrada";
    setSegmentGroup("sale-result-group", saleResult);
    resetQty(saleQty);
    renderProductList("sale-products", saleQty, "sale-total");
  }

  window.scrollTo({ top: 0, behavior: "smooth" });
}

function closeForm() {
  formScreen.classList.add("hidden");
  document.querySelector(".tabbar").style.display = "";
  hideAllFormModes();
}

function switchTab(tab) {
  currentTab = tab;
  closeForm();
  closeActionSheet();
  Object.entries(screens).forEach(([key, node]) => {
    node.classList.toggle("active", key === tab);
  });
  document.querySelectorAll(".tab").forEach((button) => {
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
    if (resultFilter === "scheduled" && visit.kind !== "scheduled") return false;
    if (resultFilter === "scheduled" && visit.fecha !== calendarDay) return false;
    if (resultFilter === "sale" && !isSale(visit.result)) return false;
    if (resultFilter === "partial" && visit.result !== "Venta parcial") return false;
    if (resultFilter === "none" && visit.result !== "Sin venta") return false;
    if (resultFilter === "all" && visit.kind === "scheduled") return false;
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
    button.addEventListener("click", openActionSheet);
  });
}

function renderWeekStrip(visits) {
  const start = addDaysISO(todayISO(), -1);
  const days = Array.from({ length: 7 }, (_, index) => addDaysISO(start, index));
  weekStrip.innerHTML = days.map((day) => {
    const count = scheduledVisits(visits).filter((visit) => visit.fecha === day).length;
    const [y, m, d] = day.split("-").map(Number);
    const label = new Date(y, m - 1, d).toLocaleDateString("es-VE", { weekday: "short" });
    return `
      <button class="day-chip ${day === calendarDay ? "active" : ""}" type="button" data-day="${day}">
        <span>${escapeHtml(label)}</span>
        <strong>${d}</strong>
        <em>${count}</em>
      </button>
    `;
  }).join("");

  weekStrip.querySelectorAll("[data-day]").forEach((button) => {
    button.addEventListener("click", () => {
      calendarDay = button.dataset.day;
      renderVisits(getSellerVisits());
    });
  });

  document.getElementById("calendar-day-label").textContent =
    `Programadas · ${formatDateShort(calendarDay)}`;
}

function renderHome(visits) {
  const seller = getSeller();
  const today = visitsToday(visits);
  const summary = summarizeVisits(today);
  const recentSource = completedVisits(visits);

  document.getElementById("home-date").textContent = formatDateLong();
  document.getElementById("home-greeting").textContent = `Hola, ${firstName(seller.name)}`;
  homeAvatar.textContent = seller.initials;
  document.getElementById("route-title").textContent =
    summary.visits ? seller.ruta : "Tu ruta comienza aquí";
  document.getElementById("route-progress").style.width = `${summary.goalProgress}%`;
  document.getElementById("route-count").textContent =
    `${summary.visits} de ${DAILY_GOAL} visitas registradas`;
  document.getElementById("route-percent").textContent = `${summary.goalProgress}%`;
  document.getElementById("metric-visits").textContent = summary.visits;
  document.getElementById("metric-sales").textContent = `$${formatCurrency(summary.sales)}`;
  document.getElementById("metric-effectiveness").textContent = `${summary.effectiveness}%`;

  const recent = document.getElementById("recent-list");
  if (!recentSource.length) {
    recent.innerHTML = renderEmpty(
      "Registra una visita o una venta para ver actividad.",
      "Registrar actividad"
    );
    bindEmptyActions(recent);
    return;
  }

  recent.innerHTML = recentSource.slice(0, 3).map((visit) => renderVisitCard(visit)).join("");
}

function renderVisits(visits) {
  const list = document.getElementById("visits-list");
  const showCalendar = resultFilter === "scheduled";
  calendarPanel.classList.toggle("hidden", !showCalendar);
  if (showCalendar) renderWeekStrip(visits);

  const filtered = filteredVisits(visits);
  const completedCount = completedVisits(visits).length;
  const scheduledCount = scheduledVisits(visits).length;
  document.getElementById("visits-count").textContent =
    `${completedCount} hechas · ${scheduledCount} programadas`;

  if (!visits.length) {
    list.innerHTML = renderEmpty(
      "Aún no hay visitas ni ventas en este dispositivo.",
      "Registrar actividad"
    );
    bindEmptyActions(list);
    return;
  }

  if (!filtered.length) {
    list.innerHTML = `
      <div class="empty">
        <h3>${showCalendar ? "Sin visitas ese día" : "Sin coincidencias"}</h3>
        <p>${showCalendar ? "Programa una visita o elige otro día del calendario." : "Prueba otra búsqueda o filtro."}</p>
        ${showCalendar ? '<button class="primary-btn" type="button" data-empty-action="schedule">Programar visita</button>' : ""}
      </div>
    `;
    list.querySelectorAll("[data-empty-action='schedule']").forEach((button) => {
      button.addEventListener("click", () => openForm("schedule"));
    });
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
    `en ${all.visits} visita${all.visits === 1 ? "" : "s"} · ${all.scheduled} programada${all.scheduled === 1 ? "" : "s"}`;
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
  closeActionSheet();
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

function pushVisit(payload) {
  const visits = loadVisits();
  visits.push(normalizeVisit(payload));
  saveVisits(visits);
}

fillEstadoSelect(document.getElementById("estado"));
fillEstadoSelect(document.getElementById("schedule-estado"));
fillEstadoSelect(document.getElementById("sale-estado"));

if (!loadVisits().length) seedDemoVisits();

document.querySelectorAll(".tab").forEach((button) => {
  button.addEventListener("click", () => switchTab(button.dataset.tab));
});

document.getElementById("cta-register").addEventListener("click", openActionSheet);
document.getElementById("visits-add-btn").addEventListener("click", openActionSheet);
document.getElementById("see-all-btn").addEventListener("click", () => switchTab("visits"));
document.getElementById("form-back-btn").addEventListener("click", closeForm);
document.getElementById("schedule-from-visits-btn").addEventListener("click", () => openForm("schedule"));
homeAvatar.addEventListener("click", openSellerSheet);
document.getElementById("seller-sheet-backdrop").addEventListener("click", closeSellerSheet);
document.getElementById("action-sheet-backdrop").addEventListener("click", closeActionSheet);

document.querySelectorAll("#action-sheet [data-action]").forEach((button) => {
  button.addEventListener("click", () => openForm(button.dataset.action));
});

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
    if (!isSale(selectedResult)) resetQty(visitQty);
    syncVisitProductsVisibility();
  });
});

document.querySelectorAll("#sale-result-group .segment").forEach((button) => {
  button.addEventListener("click", () => {
    saleResult = button.dataset.value;
    setSegmentGroup("sale-result-group", saleResult);
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
    alert("No se pudo procesar la foto.");
  }
});

visitForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const client = document.getElementById("client").value.trim();
  if (!client) {
    clientError.classList.remove("hidden");
    return;
  }
  clientError.classList.add("hidden");

  if (isSale(selectedResult) && qtyMapTotal(visitQty) <= 0) {
    alert("Agrega al menos un producto para registrar la venta.");
    return;
  }

  const seller = getSeller();
  const now = new Date();
  const lines = isSale(selectedResult) ? qtyMapToLines(visitQty) : [];
  pushVisit({
    kind: "completed",
    client,
    status: selectedStatus,
    result: selectedResult,
    lines,
    amount: linesTotal(lines),
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

  visitForm.reset();
  clearPhotoPreview();
  resetQty(visitQty);
  fillEstadoSelect(document.getElementById("estado"));
  gpsStatus.textContent = "Usa el GPS del teléfono o escribe la dirección.";
  closeForm();
  switchTab("visits");
});

scheduleForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const client = document.getElementById("schedule-client").value.trim();
  const error = document.getElementById("schedule-client-error");
  if (!client) {
    error.classList.remove("hidden");
    return;
  }
  error.classList.add("hidden");

  const seller = getSeller();
  const date = document.getElementById("schedule-date").value || addDaysISO(todayISO(), 1);
  pushVisit({
    kind: "scheduled",
    client,
    status: "Programada",
    result: "Programada",
    scheduledDate: date,
    fecha: date,
    estado: document.getElementById("schedule-estado").value,
    location: document.getElementById("schedule-location").value.trim(),
    notes: document.getElementById("schedule-notes").value.trim(),
    createdAt: new Date().toISOString(),
    vendedorId: seller.id,
    vendedor: seller.name,
    ruta: seller.ruta,
  });

  scheduleForm.reset();
  fillEstadoSelect(document.getElementById("schedule-estado"));
  calendarDay = date;
  resultFilter = "scheduled";
  document.querySelectorAll(".chip").forEach((node) => {
    node.classList.toggle("active", node.dataset.filter === "scheduled");
  });
  closeForm();
  switchTab("visits");
});

saleForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const client = document.getElementById("sale-client").value.trim();
  const error = document.getElementById("sale-client-error");
  if (!client) {
    error.classList.remove("hidden");
    return;
  }
  error.classList.add("hidden");

  const lines = qtyMapToLines(saleQty);
  if (!lines.length) {
    alert("Selecciona al menos un producto del inventario.");
    return;
  }

  const seller = getSeller();
  const now = new Date();
  pushVisit({
    kind: "completed",
    client,
    status: "Visitado",
    result: saleResult,
    lines,
    amount: linesTotal(lines),
    estado: document.getElementById("sale-estado").value,
    location: document.getElementById("sale-estado").value,
    notes: document.getElementById("sale-notes").value.trim(),
    createdAt: now.toISOString(),
    hora: formatTime(now),
    fecha: todayISO(),
    vendedorId: seller.id,
    vendedor: seller.name,
    ruta: seller.ruta,
  });

  saleForm.reset();
  resetQty(saleQty);
  fillEstadoSelect(document.getElementById("sale-estado"));
  closeForm();
  switchTab("visits");
});

render();
