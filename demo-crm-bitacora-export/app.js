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

const createForm = document.getElementById("create-form");
const closeVisitForm = document.getElementById("close-form");
const saleForm = document.getElementById("sale-form");

let currentTab = "home";
let resultFilter = "all";
let calendarDay = todayISO();
let createWhen = "now";
let closeResult = "Venta cerrada";
let closeFollowUp = "none";
let saleLink = "visit";
let saleResult = "Venta cerrada";
let pendingPhoto = "";
let closeQty = Object.fromEntries(PRODUCTS.map((p) => [p.id, 0]));
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
        qtyMap[productId] = Math.max(0, Number(qtyMap[productId] || 0) + Number(button.dataset.step));
        renderProductList(containerId, qtyMap, totalId);
      });
    });
  });

  document.getElementById(totalId).textContent = `$${formatCurrency(qtyMapTotal(qtyMap))}`;
}

function closableVisits(visits) {
  const today = todayISO();
  return openVisits(visits).filter((visit) =>
    visit.status === "En curso" || (visit.status === "Programada" && visit.fecha === today)
  );
}

function syncCreateWhen() {
  const later = createWhen === "later";
  document.getElementById("create-date-field").classList.toggle("hidden", !later);
  document.getElementById("create-submit-btn").textContent = later
    ? "Guardar en agenda"
    : "Iniciar visita ahora";
  if (later && !document.getElementById("create-date").value) {
    document.getElementById("create-date").value = addDaysISO(todayISO(), 1);
  }
}

function syncCloseResult() {
  const showProducts = isSale(closeResult);
  document.getElementById("close-products-field").classList.toggle("hidden", !showProducts);
  if (showProducts) renderProductList("close-products", closeQty, "close-sale-total");
  document.getElementById("close-follow-date-field").classList.toggle(
    "hidden",
    closeFollowUp !== "schedule"
  );
}

function syncSaleLink() {
  const linked = saleLink === "visit";
  document.getElementById("sale-visit-field").classList.toggle("hidden", !linked);
  document.getElementById("sale-client-field").classList.toggle("hidden", linked);
  document.getElementById("sale-estado-field").classList.toggle("hidden", linked);
}

function fillCloseVisitSelect() {
  const select = document.getElementById("close-visit-id");
  const options = closableVisits(getSellerVisits());
  if (!options.length) {
    select.innerHTML = `<option value="">No hay visitas abiertas</option>`;
    return;
  }
  select.innerHTML = options.map((visit) => `
    <option value="${escapeHtml(visit.id)}">
      ${escapeHtml(visit.client)} · ${escapeHtml(visit.status)}
    </option>
  `).join("");
}

function fillSaleVisitSelect() {
  const select = document.getElementById("sale-visit-id");
  const options = closableVisits(getSellerVisits()).concat(
    completedVisits(getSellerVisits()).filter((visit) => visit.fecha === todayISO() && !visit.saleOnly)
  );
  const unique = [];
  const seen = new Set();
  options.forEach((visit) => {
    if (!seen.has(visit.id)) {
      seen.add(visit.id);
      unique.push(visit);
    }
  });

  if (!unique.length) {
    select.innerHTML = `<option value="">No hay visitas de hoy</option>`;
    return;
  }

  select.innerHTML = unique.map((visit) => `
    <option value="${escapeHtml(visit.id)}">
      ${escapeHtml(visit.client)} · ${escapeHtml(visit.status)}${visit.result ? ` · ${escapeHtml(visit.result)}` : ""}
    </option>
  `).join("");
}

function openActionSheet() {
  closeSellerSheet();
  actionSheet.classList.remove("hidden");
}

function closeActionSheet() {
  actionSheet.classList.add("hidden");
}

function hideAllFormModes() {
  document.querySelectorAll(".form-mode").forEach((form) => form.classList.add("hidden"));
}

function openForm(mode = "create") {
  closeActionSheet();
  hideAllFormModes();
  formScreen.classList.remove("hidden");
  document.querySelector(".tabbar").style.display = "none";

  const titles = {
    create: ["CREAR VISITA", "Nueva visita"],
    close: ["CERRAR VISITA", "Completar visita abierta"],
    sale: ["VENTA", "Registrar venta"],
  };
  const [eyebrow, title] = titles[mode];
  document.getElementById("form-eyebrow").textContent = eyebrow;
  document.getElementById("form-title").textContent = title;

  if (mode === "create") {
    createForm.classList.remove("hidden");
    createWhen = "now";
    setSegmentGroup("when-group", createWhen);
    syncCreateWhen();
  } else if (mode === "close") {
    closeVisitForm.classList.remove("hidden");
    closeResult = "Venta cerrada";
    closeFollowUp = "none";
    setSegmentGroup("close-result-group", closeResult);
    setSegmentGroup("close-follow-group", closeFollowUp);
    resetQty(closeQty);
    fillCloseVisitSelect();
    syncCloseResult();
    document.getElementById("close-follow-date").value = addDaysISO(todayISO(), 1);
  } else if (mode === "sale") {
    saleForm.classList.remove("hidden");
    saleLink = "visit";
    saleResult = "Venta cerrada";
    setSegmentGroup("sale-link-group", saleLink);
    setSegmentGroup("sale-result-group", saleResult);
    resetQty(saleQty);
    fillSaleVisitSelect();
    syncSaleLink();
    renderProductList("sale-products", saleQty, "sale-total");
  }

  window.scrollTo({ top: 0, behavior: "smooth" });
}

function closeForm() {
  formScreen.classList.add("hidden");
  document.querySelector(".tabbar").style.display = "";
  hideAllFormModes();
  clearClosePhoto();
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
    if (resultFilter === "all" && visit.status !== "Completada") return false;
    if (resultFilter === "open" && !isOpenVisit(visit)) return false;
    if (resultFilter === "scheduled") {
      if (visit.status !== "Programada") return false;
      if (visit.fecha !== calendarDay) return false;
    }
    if (resultFilter === "sale" && !isSale(visit.result)) return false;
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
    `Agenda · ${formatDateShort(calendarDay)}`;
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
      "Crea una visita o registra una venta para empezar.",
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
  const summary = summarizeVisits(visits);
  document.getElementById("visits-count").textContent =
    `${summary.visits} hechas · ${summary.inProgress} en curso · ${summary.scheduled} en agenda`;

  if (!visits.length) {
    list.innerHTML = renderEmpty("Aún no hay actividad en este dispositivo.", "Registrar actividad");
    bindEmptyActions(list);
    return;
  }

  if (!filtered.length) {
    list.innerHTML = `
      <div class="empty">
        <h3>Sin coincidencias</h3>
        <p>Prueba otro filtro o crea una visita.</p>
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
    `en ${all.visits} completadas · ${all.scheduled} en agenda`;
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

function clearClosePhoto() {
  pendingPhoto = "";
  const preview = document.getElementById("close-photo-preview");
  preview.innerHTML = "";
  preview.classList.add("hidden");
  document.getElementById("close-photo").value = "";
}

function openSellerSheet() {
  closeActionSheet();
  const current = getSeller();
  sellerOptions.innerHTML = SELLERS.map((seller) => `
    <button class="seller-option ${seller.id === current.id ? "active" : ""}" type="button" data-seller="${seller.id}">
      <span class="seller-avatar">${escapeHtml(seller.initials)}</span>
      <span class="seller-copy">
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

function captureGps(locationId, latId, lngId, statusId, button) {
  const status = document.getElementById(statusId);
  if (!navigator.geolocation) {
    status.textContent = "GPS no disponible. Escribe la dirección.";
    status.classList.add("error");
    return;
  }
  button.disabled = true;
  status.textContent = "Obteniendo ubicación…";
  status.classList.remove("error");

  navigator.geolocation.getCurrentPosition(
    async (position) => {
      const { latitude, longitude, accuracy } = position.coords;
      document.getElementById(latId).value = String(latitude);
      document.getElementById(lngId).value = String(longitude);
      try {
        document.getElementById(locationId).value = await reverseGeocode(latitude, longitude);
        status.textContent = `Ubicación capturada (±${Math.round(accuracy)} m).`;
      } catch (error) {
        document.getElementById(locationId).value = `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
        status.textContent = "Coordenadas capturadas.";
      } finally {
        button.disabled = false;
      }
    },
    () => {
      button.disabled = false;
      status.classList.add("error");
      status.textContent = "No se pudo obtener GPS. Escribe la dirección.";
    },
    { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
  );
}

function upsertVisit(visit) {
  const visits = loadVisits();
  const index = visits.findIndex((item) => item.id === visit.id);
  if (index >= 0) visits[index] = normalizeVisit(visit);
  else visits.push(normalizeVisit(visit));
  saveVisits(visits);
}

fillEstadoSelect(document.getElementById("create-estado"));
fillEstadoSelect(document.getElementById("sale-estado"));

if (!loadVisits().length) seedDemoVisits();

document.querySelectorAll(".tab").forEach((button) => {
  button.addEventListener("click", () => switchTab(button.dataset.tab));
});

document.getElementById("cta-register").addEventListener("click", openActionSheet);
document.getElementById("visits-add-btn").addEventListener("click", openActionSheet);
document.getElementById("see-all-btn").addEventListener("click", () => switchTab("visits"));
document.getElementById("form-back-btn").addEventListener("click", closeForm);
document.getElementById("schedule-from-visits-btn").addEventListener("click", () => openForm("create"));
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

document.querySelectorAll("#when-group .segment").forEach((button) => {
  button.addEventListener("click", () => {
    createWhen = button.dataset.value;
    setSegmentGroup("when-group", createWhen);
    syncCreateWhen();
  });
});

document.querySelectorAll("#close-result-group .segment").forEach((button) => {
  button.addEventListener("click", () => {
    closeResult = button.dataset.value;
    setSegmentGroup("close-result-group", closeResult);
    if (!isSale(closeResult)) resetQty(closeQty);
    syncCloseResult();
  });
});

document.querySelectorAll("#close-follow-group .segment").forEach((button) => {
  button.addEventListener("click", () => {
    closeFollowUp = button.dataset.value;
    setSegmentGroup("close-follow-group", closeFollowUp);
    syncCloseResult();
  });
});

document.querySelectorAll("#sale-link-group .segment").forEach((button) => {
  button.addEventListener("click", () => {
    saleLink = button.dataset.value;
    setSegmentGroup("sale-link-group", saleLink);
    syncSaleLink();
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

document.getElementById("create-gps-btn").addEventListener("click", (event) => {
  captureGps("create-location", "create-lat", "create-lng", "create-gps-status", event.currentTarget);
});

document.getElementById("close-photo").addEventListener("change", async () => {
  const file = document.getElementById("close-photo").files?.[0];
  if (!file) {
    clearClosePhoto();
    return;
  }
  try {
    pendingPhoto = await compressImage(file);
    const preview = document.getElementById("close-photo-preview");
    preview.innerHTML = `
      <img src="${pendingPhoto}" alt="Evidencia">
      <button class="ghost" type="button" id="remove-close-photo">Quitar foto</button>
    `;
    preview.classList.remove("hidden");
    document.getElementById("remove-close-photo").addEventListener("click", clearClosePhoto);
  } catch (error) {
    clearClosePhoto();
    alert("No se pudo procesar la foto.");
  }
});

createForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const client = document.getElementById("create-client").value.trim();
  const error = document.getElementById("create-client-error");
  if (!client) {
    error.classList.remove("hidden");
    return;
  }
  error.classList.add("hidden");

  const seller = getSeller();
  const now = new Date();
  const later = createWhen === "later";
  const date = later
    ? (document.getElementById("create-date").value || addDaysISO(todayISO(), 1))
    : todayISO();

  upsertVisit({
    status: later ? "Programada" : "En curso",
    client,
    estado: document.getElementById("create-estado").value,
    location: document.getElementById("create-location").value.trim(),
    latitude: document.getElementById("create-lat").value
      ? Number(document.getElementById("create-lat").value)
      : null,
    longitude: document.getElementById("create-lng").value
      ? Number(document.getElementById("create-lng").value)
      : null,
    notes: document.getElementById("create-notes").value.trim(),
    createdAt: now.toISOString(),
    fecha: date,
    scheduledDate: later ? date : "",
    hora: later ? "" : formatTime(now),
    vendedorId: seller.id,
    vendedor: seller.name,
    ruta: seller.ruta,
  });

  createForm.reset();
  fillEstadoSelect(document.getElementById("create-estado"));
  createWhen = "now";
  setSegmentGroup("when-group", createWhen);
  syncCreateWhen();
  closeForm();
  resultFilter = later ? "scheduled" : "open";
  if (later) calendarDay = date;
  document.querySelectorAll(".chip").forEach((node) => {
    node.classList.toggle("active", node.dataset.filter === resultFilter);
  });
  switchTab("visits");
});

closeVisitForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const visitId = document.getElementById("close-visit-id").value;
  if (!visitId) {
    alert("No hay visitas abiertas para cerrar. Crea una visita primero.");
    return;
  }

  if (isSale(closeResult) && qtyMapTotal(closeQty) <= 0) {
    alert("Agrega productos para una venta parcial o cerrada.");
    return;
  }

  const visits = loadVisits();
  const current = visits.find((visit) => visit.id === visitId);
  if (!current) return;

  const now = new Date();
  const lines = isSale(closeResult) ? qtyMapToLines(closeQty) : [];
  const notes = document.getElementById("close-notes").value.trim() || current.notes;

  upsertVisit({
    ...current,
    status: "Completada",
    result: closeResult,
    lines,
    amount: linesTotal(lines),
    followUp: closeFollowUp,
    notes,
    photoUri: pendingPhoto || current.photoUri || "",
    hora: formatTime(now),
    fecha: todayISO(),
    createdAt: now.toISOString(),
  });

  if (closeFollowUp === "schedule") {
    const seller = getSeller();
    const followDate = document.getElementById("close-follow-date").value || addDaysISO(todayISO(), 1);
    upsertVisit({
      status: "Programada",
      client: current.client,
      estado: current.estado,
      location: current.location,
      notes: `Seguimiento de visita anterior. ${notes}`.trim(),
      fecha: followDate,
      scheduledDate: followDate,
      createdAt: now.toISOString(),
      vendedorId: seller.id,
      vendedor: seller.name,
      ruta: seller.ruta,
    });
  }

  closeVisitForm.reset();
  resetQty(closeQty);
  clearClosePhoto();
  closeForm();
  resultFilter = "all";
  document.querySelectorAll(".chip").forEach((node) => {
    node.classList.toggle("active", node.dataset.filter === "all");
  });
  switchTab("visits");
});

saleForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const lines = qtyMapToLines(saleQty);
  if (!lines.length) {
    alert("Selecciona al menos un producto.");
    return;
  }

  const seller = getSeller();
  const now = new Date();
  const notes = document.getElementById("sale-notes").value.trim();

  if (saleLink === "visit") {
    const visitId = document.getElementById("sale-visit-id").value;
    if (!visitId) {
      alert("No hay visita para relacionar. Cambia a venta suelta o crea una visita.");
      return;
    }
    const current = loadVisits().find((visit) => visit.id === visitId);
    if (!current) return;

    upsertVisit({
      ...current,
      status: "Completada",
      result: saleResult,
      lines,
      amount: linesTotal(lines),
      notes: notes || current.notes,
      hora: formatTime(now),
      fecha: todayISO(),
      createdAt: now.toISOString(),
      saleOnly: false,
      relatedVisitId: "",
    });
  } else {
    const client = document.getElementById("sale-client").value.trim();
    const error = document.getElementById("sale-client-error");
    if (!client) {
      error.classList.remove("hidden");
      return;
    }
    error.classList.add("hidden");

    upsertVisit({
      status: "Completada",
      result: saleResult,
      saleOnly: true,
      client,
      lines,
      amount: linesTotal(lines),
      estado: document.getElementById("sale-estado").value,
      location: document.getElementById("sale-estado").value,
      notes: notes || "Venta sin visita presencial.",
      createdAt: now.toISOString(),
      hora: formatTime(now),
      fecha: todayISO(),
      vendedorId: seller.id,
      vendedor: seller.name,
      ruta: seller.ruta,
    });
  }

  saleForm.reset();
  resetQty(saleQty);
  fillEstadoSelect(document.getElementById("sale-estado"));
  closeForm();
  resultFilter = "sale";
  document.querySelectorAll(".chip").forEach((node) => {
    node.classList.toggle("active", node.dataset.filter === "sale");
  });
  switchTab("visits");
});

render();
