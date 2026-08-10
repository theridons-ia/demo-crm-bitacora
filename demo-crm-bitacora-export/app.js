const screens = {
  home: document.getElementById("screen-home"),
  visits: document.getElementById("screen-visits"),
  sales: document.getElementById("screen-sales"),
  inventory: document.getElementById("screen-inventory"),
  insights: document.getElementById("screen-insights"),
};

const formScreen = document.getElementById("screen-form");
const actionSheet = document.getElementById("action-sheet");
const visitSheet = document.getElementById("visit-sheet");
const sellerSheet = document.getElementById("seller-sheet");
const sellerOptions = document.getElementById("seller-options");
const homeAvatar = document.getElementById("home-avatar");
const searchInput = document.getElementById("search-input");
const calendarPanel = document.getElementById("calendar-panel");
const weekStrip = document.getElementById("week-strip");

const createForm = document.getElementById("create-form");
const closeVisitForm = document.getElementById("close-form");
const orderForm = document.getElementById("order-form");
const clientForm = document.getElementById("client-form");

let currentTab = "home";
let resultFilter = "all";
let salesFilter = "all";
let inventoryCategory = "all";
let calendarDay = todayISO();
let createWhen = "now";
let closeOutcome = "con_venta";
let closeFollowUp = "none";
let orderStatus = "Confirmada";
let orderPriceList = "list";
let pendingPhoto = "";
let orderQty = Object.fromEntries(PRODUCTS.map((p) => [p.id, 0]));
let activeVisitId = "";
let clientReturnMode = "";
let currentFormMode = "";
let formDraft = null;
let pendingCloseVisitId = "";
const salesSearchInput = document.getElementById("sales-search-input");

function snapshotForm(mode) {
  if (mode === "order") {
    return {
      mode: "order",
      clientId: document.getElementById("order-client-id").value,
      visitId: document.getElementById("order-visit-id").value,
      notes: document.getElementById("order-notes").value,
      status: orderStatus,
      priceList: orderPriceList,
      qty: { ...orderQty },
    };
  }
  if (mode === "create") {
    return {
      mode: "create",
      clientId: document.getElementById("create-client-id").value,
      when: createWhen,
      date: document.getElementById("create-date").value,
      location: document.getElementById("create-location").value,
      lat: document.getElementById("create-lat").value,
      lng: document.getElementById("create-lng").value,
      notes: document.getElementById("create-notes").value,
    };
  }
  return null;
}

function firstName(fullName) {
  return String(fullName || "").split(" ")[0] || "vendedor";
}

function setSegmentGroup(groupId, value) {
  document.querySelectorAll(`#${groupId} .segment`).forEach((button) => {
    button.classList.toggle("active", button.dataset.value === value);
  });
}

function fillEstadoSelect(select, selected = "") {
  select.innerHTML =
    `<option value="">Selecciona un estado</option>` +
    ESTADOS.map((estado) => `<option value="${escapeHtml(estado)}">${escapeHtml(estado)}</option>`).join("");
  if (selected) select.value = selected;
}

function fillMotiveSelect(selected = "rutina") {
  const select = document.getElementById("close-motive");
  select.innerHTML = VISIT_MOTIVES.map((motive) =>
    `<option value="${escapeHtml(motive.id)}">${escapeHtml(motive.label)}</option>`
  ).join("");
  select.value = selected;
}

function fillClientSelect(selectId, selectedId = "", metaId = "") {
  const select = document.getElementById(selectId);
  const clients = loadClients().slice().sort((a, b) => a.name.localeCompare(b.name, "es"));
  select.innerHTML = `<option value="">Selecciona un cliente</option>` + clients.map((client) => `
    <option value="${escapeHtml(client.id)}">
      ${escapeHtml(client.name)} · ${escapeHtml(client.rif)}
    </option>
  `).join("");
  if (selectedId && clients.some((client) => client.id === selectedId)) {
    select.value = selectedId;
  }
  updateClientMeta(selectId, metaId);
}

function updateClientMeta(selectId, metaId) {
  if (!metaId) return;
  const meta = document.getElementById(metaId);
  const client = getClient(document.getElementById(selectId).value);
  meta.textContent = client
    ? `${client.rif} · ${client.address}${client.estado ? ` · ${client.estado}` : ""}`
    : "";
}

function qtyMapTotal(qtyMap, priceList = orderPriceList) {
  return PRODUCTS.reduce((sum, product) => {
    const qty = Number(qtyMap[product.id] || 0);
    return sum + productPrice(product, priceList) * qty;
  }, 0);
}

function qtyMapToLines(qtyMap, priceList = orderPriceList) {
  return PRODUCTS
    .filter((product) => Number(qtyMap[product.id] || 0) > 0)
    .map((product) => ({
      productId: product.id,
      code: product.code,
      name: product.name,
      unitPrice: productPrice(product, priceList),
      qty: Number(qtyMap[product.id]),
    }));
}

function resetQty(qtyMap) {
  PRODUCTS.forEach((product) => {
    qtyMap[product.id] = 0;
  });
}

function renderProductList(containerId, qtyMap, totalId, priceList = orderPriceList) {
  const container = document.getElementById(containerId);
  container.innerHTML = PRODUCTS.map((product) => `
    <div class="product-row" data-product="${product.id}">
      <img class="product-thumb" src="${escapeHtml(product.image)}" alt="" width="44" height="44">
      <div class="product-copy">
        <strong>${escapeHtml(product.name)}</strong>
        <p>${escapeHtml(product.code)} · $${formatCurrency(productPrice(product, priceList))} / ${escapeHtml(product.unit)}</p>
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
        renderProductList(containerId, qtyMap, totalId, priceList);
      });
    });
  });

  document.getElementById(totalId).textContent = `$${formatCurrency(qtyMapTotal(qtyMap, priceList))}`;
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

function syncCloseOutcome() {
  const showOrders = closeOutcome === "con_venta";
  document.getElementById("close-orders-section").classList.toggle("hidden", !showOrders);
  document.getElementById("close-follow-date-field").classList.toggle(
    "hidden",
    closeFollowUp !== "schedule"
  );

  const visitId = document.getElementById("close-visit-id").value;
  const list = document.getElementById("close-orders-list");
  const hint = document.getElementById("close-order-hint");
  const linked = visitId ? ordersForVisit(visitId) : [];

  if (!showOrders) return;

  if (!linked.length) {
    list.innerHTML = "";
    hint.textContent = "Sin órdenes aún. Usa “+ Agregar orden” para crear una.";
    return;
  }

  list.innerHTML = linked.map((order) => renderLinkedOrderRow(order)).join("");
  const total = linked.reduce((sum, order) => sum + Number(order.amount || 0), 0);
  hint.textContent = `${linked.length} orden(es) · total $${formatCurrency(total)}`;
}

function openActionSheet() {
  closeSellerSheet();
  closeVisitSheet();
  actionSheet.classList.remove("hidden");
}

function closeActionSheet() {
  actionSheet.classList.add("hidden");
}

function closeVisitSheet() {
  visitSheet.classList.add("hidden");
  activeVisitId = "";
}

function openVisitSheet(visitId) {
  const visit = loadVisits().find((item) => item.id === visitId);
  if (!visit) return;
  activeVisitId = visitId;
  closeActionSheet();
  closeSellerSheet();
  const client = getClient(visit.clientId);
  document.getElementById("visit-sheet-title").textContent =
    visit.status === "En curso" ? "Visita en curso" : visit.status === "Programada" ? "Visita programada" : "Visita";
  document.getElementById("visit-sheet-sub").textContent =
    `${client?.name || visit.clientName}${visit.hora ? ` · desde ${visit.hora}` : ""}`;
  document.getElementById("visit-sheet-start").hidden = visit.status !== "Programada";
  visitSheet.classList.remove("hidden");
}

function hideAllFormModes() {
  document.querySelectorAll(".form-mode").forEach((form) => form.classList.add("hidden"));
}

function fillCloseVisitSelect(selectedId = "") {
  const select = document.getElementById("close-visit-id");
  const options = closableVisits(getSellerVisits());
  if (!options.length) {
    select.innerHTML = `<option value="">No hay visitas abiertas</option>`;
    return;
  }
  select.innerHTML = options.map((visit) => `
    <option value="${escapeHtml(visit.id)}">
      ${escapeHtml(visit.clientName)} · ${escapeHtml(visit.status)}${visit.hora ? ` · ${escapeHtml(visit.hora)}` : ""}
    </option>
  `).join("");
  if (selectedId && options.some((visit) => visit.id === selectedId)) {
    select.value = selectedId;
  }
}

function fillOrderVisitSelect(selectedId = "", clientId = "") {
  const select = document.getElementById("order-visit-id");
  let options = getSellerVisits().filter((visit) =>
    visit.status === "En curso" ||
    (visit.status === "Programada" && visit.fecha === todayISO()) ||
    (visit.status === "Completada" && visit.fecha === todayISO())
  );
  if (clientId) options = options.filter((visit) => visit.clientId === clientId);
  select.innerHTML = `<option value="">Sin visita</option>` + options.map((visit) => `
    <option value="${escapeHtml(visit.id)}">
      ${escapeHtml(visit.clientName)} · ${escapeHtml(visit.status)}
    </option>
  `).join("");
  if (selectedId) select.value = selectedId;
}

function openForm(mode = "create", options = {}) {
  closeActionSheet();
  closeVisitSheet();
  hideAllFormModes();
  formScreen.classList.remove("hidden");
  document.querySelector(".tabbar").style.display = "none";
  currentFormMode = mode;

  const titles = {
    create: ["CREAR VISITA", "Nueva visita"],
    close: ["CERRAR VISITA", "Completar visita abierta"],
    order: ["ORDEN DE VENTA", "Nueva orden de venta"],
    client: ["CLIENTE", "Nuevo cliente"],
  };
  const [eyebrow, title] = titles[mode] || titles.create;
  document.getElementById("form-eyebrow").textContent = eyebrow;
  document.getElementById("form-title").textContent = title;

  if (mode === "create") {
    createForm.classList.remove("hidden");
    const restore = options.restore;
    createWhen = restore?.when || "now";
    setSegmentGroup("when-group", createWhen);
    syncCreateWhen();
    fillClientSelect(
      "create-client-id",
      options.clientId || restore?.clientId || "",
      "create-client-meta"
    );
    if (restore) {
      document.getElementById("create-date").value = restore.date || "";
      document.getElementById("create-location").value = restore.location || "";
      document.getElementById("create-lat").value = restore.lat || "";
      document.getElementById("create-lng").value = restore.lng || "";
      document.getElementById("create-notes").value = restore.notes || "";
    } else {
      const client = getClient(document.getElementById("create-client-id").value);
      if (client && !document.getElementById("create-location").value) {
        document.getElementById("create-location").value = client.address;
      }
    }
  } else if (mode === "close") {
    closeVisitForm.classList.remove("hidden");
    closeOutcome = "con_venta";
    closeFollowUp = "none";
    setSegmentGroup("close-outcome-group", closeOutcome);
    setSegmentGroup("close-follow-group", closeFollowUp);
    fillMotiveSelect("rutina");
    fillCloseVisitSelect(options.visitId || pendingCloseVisitId || "");
    syncCloseOutcome();
    document.getElementById("close-follow-date").value = addDaysISO(todayISO(), 1);
  } else if (mode === "order") {
    orderForm.classList.remove("hidden");
    const restore = options.restore;
    orderStatus = restore?.status || "Confirmada";
    orderPriceList = restore?.priceList || "list";
    setSegmentGroup("order-status-group", orderStatus);
    setSegmentGroup("order-price-group", orderPriceList);
    if (restore?.qty) {
      orderQty = { ...Object.fromEntries(PRODUCTS.map((p) => [p.id, 0])), ...restore.qty };
    } else {
      resetQty(orderQty);
    }
    const clientId = options.clientId || restore?.clientId || "";
    const visitId = options.visitId || restore?.visitId || "";
    fillClientSelect("order-client-id", clientId, "order-client-meta");
    fillOrderVisitSelect(visitId, clientId || document.getElementById("order-client-id").value);
    if (visitId && !restore) {
      const visit = loadVisits().find((item) => item.id === visitId);
      if (visit) {
        fillClientSelect("order-client-id", visit.clientId, "order-client-meta");
        fillOrderVisitSelect(visit.id, visit.clientId);
      }
    }
    if (restore?.notes != null) {
      document.getElementById("order-notes").value = restore.notes;
    }
    renderProductList("order-products", orderQty, "order-total", orderPriceList);
  } else if (mode === "client") {
    clientForm.classList.remove("hidden");
    clientReturnMode = options.returnMode || "";
    fillEstadoSelect(document.getElementById("client-estado"));
    clientForm.reset();
    fillEstadoSelect(document.getElementById("client-estado"));
  }

  window.scrollTo({ top: 0, behavior: "smooth" });
  refreshIcons();
}

function closeForm() {
  formScreen.classList.add("hidden");
  document.querySelector(".tabbar").style.display = "";
  hideAllFormModes();
  clearClosePhoto();
  pendingCloseVisitId = "";
  currentFormMode = "";
  clientReturnMode = "";
  formDraft = null;
}

function handleFormBack() {
  if (currentFormMode === "client" && clientReturnMode) {
    const returnTo = clientReturnMode;
    const draft = formDraft;
    clientReturnMode = "";
    formDraft = null;
    if (draft) openForm(returnTo, { restore: draft });
    else openForm(returnTo);
    return;
  }
  closeForm();
}

function switchTab(tab) {
  currentTab = tab;
  closeForm();
  closeActionSheet();
  closeVisitSheet();
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

function getSellerOrders() {
  const seller = getSeller();
  return loadOrders()
    .filter((order) => order.vendedorId === seller.id)
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
    if (resultFilter === "sale" && visit.outcome !== "con_venta") return false;
    if (resultFilter === "none" && visit.outcome !== "sin_venta") return false;
    if (!query) return true;
    const client = getClient(visit.clientId);
    const haystack = `${visit.clientName} ${client?.rif || ""} ${visit.location} ${visit.estado} ${visit.notes}`.toLowerCase();
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

function bindVisitCards(container) {
  container.querySelectorAll(".visit-card[data-id]").forEach((node) => {
    const visit = loadVisits().find((item) => item.id === node.dataset.id);
    if (!visit || !isOpenVisit(visit)) return;
    if (node.tagName === "BUTTON") {
      node.addEventListener("click", () => openVisitSheet(visit.id));
      return;
    }
    node.style.cursor = "pointer";
    node.addEventListener("click", () => openVisitSheet(visit.id));
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

function renderHome(visits, orders) {
  const seller = getSeller();
  const today = todayISO();
  const todayCompleted = visitsToday(visits, today);
  const todayOrders = orders.filter((order) => order.fecha === today);
  const summary = summarizeVisits(todayCompleted, todayOrders);
  const openCount = visits.filter((visit) => visit.status === "En curso").length;
  const recentSource = [...visits].sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));

  document.getElementById("home-date").textContent = formatDateLong();
  document.getElementById("home-greeting").textContent = `Hola, ${firstName(seller.name)}`;
  homeAvatar.textContent = seller.initials;
  document.getElementById("route-title").textContent =
    summary.visits || openCount ? seller.ruta : "Tu ruta comienza aquí";
  document.getElementById("route-progress").style.width = `${summary.goalProgress}%`;
  document.getElementById("route-count").textContent =
    `${summary.visits} de ${DAILY_GOAL} visitas registradas`;
  document.getElementById("route-percent").textContent = `${summary.goalProgress}%`;
  document.getElementById("metric-visits").textContent = summary.visits;
  document.getElementById("metric-sales").textContent = `$${formatCurrency(todayOrders.reduce((sum, order) => sum + order.amount, 0))}`;
  document.getElementById("metric-effectiveness").textContent = `${summary.effectiveness}%`;
  document.getElementById("metric-open").textContent = openCount;

  const recent = document.getElementById("recent-list");
  if (!recentSource.length) {
    recent.innerHTML = renderEmpty(
      "Crea una visita u orden de venta para empezar.",
      "Registrar actividad"
    );
    bindEmptyActions(recent);
    return;
  }
  recent.innerHTML = recentSource.slice(0, 3).map((visit) =>
    renderVisitCard(visit, isOpenVisit(visit))
  ).join("");
  bindVisitCards(recent);
}

function renderVisits(visits) {
  const list = document.getElementById("visits-list");
  const showCalendar = resultFilter === "scheduled";
  calendarPanel.classList.toggle("hidden", !showCalendar);
  if (showCalendar) renderWeekStrip(visits);

  const filtered = filteredVisits(visits);
  const summary = summarizeVisits(visits, getSellerOrders());
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

  list.innerHTML = filtered.map((visit) => renderVisitCard(visit, isOpenVisit(visit))).join("");
  bindVisitCards(list);
}

function renderInventory() {
  const list = document.getElementById("inventory-list");
  const products = PRODUCTS.filter((product) =>
    inventoryCategory === "all" || product.category === inventoryCategory
  );
  list.innerHTML = products.map((product) => `
    <article class="inventory-card">
      <div class="inventory-card-top">
        <img class="product-thumb lg" src="${escapeHtml(product.image)}" alt="${escapeHtml(product.name)}" width="56" height="56">
        <span class="badge badge-muted">${escapeHtml(product.category)}</span>
      </div>
      <p class="inventory-code">${escapeHtml(product.code)}</p>
      <h3>${escapeHtml(product.name)}</h3>
      <p class="meta">${escapeHtml(product.unit)} · caduca ${escapeHtml(formatDateShort(product.expiresAt))}</p>
      <div class="inventory-prices">
        <div>
          <span>Lista</span>
          <strong>$${formatCurrency(product.listPrice)}</strong>
        </div>
        <div>
          <span>Mayor</span>
          <strong>$${formatCurrency(product.wholesalePrice)}</strong>
        </div>
      </div>
    </article>
  `).join("");
}

function renderInsights(visits, orders) {
  const today = visitsToday(visits);
  const all = summarizeVisits(visits, orders);
  const day = summarizeVisits(today, orders.filter((order) => order.fecha === todayISO()));
  const max = Math.max(all.withSale, all.none, 1);

  document.getElementById("insight-sales").textContent = `$${formatCurrency(all.sales)}`;
  document.getElementById("insight-sales-sub").textContent =
    `en ${all.visits} completadas · ${orders.length} órdenes`;
  document.getElementById("count-closed").textContent = all.withSale;
  document.getElementById("count-none").textContent = all.none;
  document.getElementById("bar-closed").style.width = `${(all.withSale / max) * 100}%`;
  document.getElementById("bar-none").style.width = `${(all.none / max) * 100}%`;
  document.getElementById("goal-count").textContent = `${day.visits} / ${DAILY_GOAL}`;
  document.getElementById("goal-ring").style.setProperty("--p", `${day.goalProgress}%`);
  document.getElementById("goal-ring").textContent = `${day.goalProgress}%`;
  document.getElementById("goal-progress").style.width = `${day.goalProgress}%`;
  document.getElementById("goal-tip").textContent = day.remaining
    ? `Te faltan ${day.remaining} visita${day.remaining === 1 ? "" : "s"} para completar el objetivo.`
    : "¡Objetivo diario completado!";

  const ordersBox = document.getElementById("insight-orders");
  ordersBox.innerHTML = orders.length
    ? orders.slice(0, 4).map((order) => renderOrderCard(order)).join("")
    : `<div class="empty"><h3>Sin órdenes</h3><p>Crea una orden de venta desde una visita o el menú.</p></div>`;
}

function filteredOrders(orders) {
  const query = (salesSearchInput?.value || "").trim().toLowerCase();
  return orders.filter((order) => {
    if (salesFilter === "today" && order.fecha !== todayISO()) return false;
    if (["Confirmada", "Parcial", "Borrador"].includes(salesFilter) && order.status !== salesFilter) {
      return false;
    }
    if (!query) return true;
    const client = getClient(order.clientId);
    const lines = (order.lines || []).map((line) => line.name).join(" ");
    const haystack = `${order.code} ${order.clientName} ${client?.rif || ""} ${order.notes} ${lines}`.toLowerCase();
    return haystack.includes(query);
  });
}

function renderSales(orders) {
  const list = document.getElementById("sales-list");
  const today = todayISO();
  const todayTotal = orders
    .filter((order) => order.fecha === today)
    .reduce((sum, order) => sum + Number(order.amount || 0), 0);
  const total = orders.reduce((sum, order) => sum + Number(order.amount || 0), 0);
  const filtered = filteredOrders(orders);

  document.getElementById("sales-count").textContent =
    `${orders.length} orden${orders.length === 1 ? "" : "es"} · $${formatCurrency(total)}`;
  document.getElementById("sales-kpi-count").textContent = String(orders.length);
  document.getElementById("sales-kpi-total").textContent = `$${formatCurrency(total)}`;
  document.getElementById("sales-kpi-today").textContent = `$${formatCurrency(todayTotal)}`;

  if (!orders.length) {
    list.innerHTML = renderEmpty("Aún no hay órdenes de venta en este dispositivo.", "Crear orden");
    list.querySelectorAll("[data-empty-action='register']").forEach((button) => {
      button.addEventListener("click", () => openForm("order"));
    });
    return;
  }

  if (!filtered.length) {
    list.innerHTML = `
      <div class="empty">
        <h3>Sin coincidencias</h3>
        <p>Prueba otro filtro o crea una nueva orden.</p>
      </div>
    `;
    return;
  }

  list.innerHTML = filtered.map((order) => renderOrderCard(order)).join("");
}

function render() {
  const visits = getSellerVisits();
  const orders = getSellerOrders();
  renderHome(visits, orders);
  renderVisits(visits);
  renderSales(orders);
  renderInventory();
  renderInsights(visits, orders);
  refreshIcons();
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
  closeVisitSheet();
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

if (!loadVisits().length && !loadOrders().length) seedDemoData();

document.querySelectorAll(".tab").forEach((button) => {
  button.addEventListener("click", () => switchTab(button.dataset.tab));
});

document.getElementById("cta-register").addEventListener("click", openActionSheet);
document.getElementById("visits-add-btn").addEventListener("click", openActionSheet);
document.getElementById("sales-add-btn").addEventListener("click", () => openForm("order"));
document.getElementById("see-all-btn").addEventListener("click", () => switchTab("visits"));
document.getElementById("form-back-btn").addEventListener("click", handleFormBack);
document.getElementById("schedule-from-visits-btn").addEventListener("click", () => openForm("create"));
homeAvatar.addEventListener("click", openSellerSheet);
document.getElementById("seller-sheet-backdrop").addEventListener("click", closeSellerSheet);
document.getElementById("action-sheet-backdrop").addEventListener("click", closeActionSheet);
document.getElementById("visit-sheet-backdrop").addEventListener("click", closeVisitSheet);

document.querySelectorAll("#action-sheet [data-action]").forEach((button) => {
  button.addEventListener("click", () => openForm(button.dataset.action));
});

document.getElementById("visit-sheet-close").addEventListener("click", () => {
  const visitId = activeVisitId;
  closeVisitSheet();
  openForm("close", { visitId });
});

document.getElementById("visit-sheet-order").addEventListener("click", () => {
  const visit = loadVisits().find((item) => item.id === activeVisitId);
  closeVisitSheet();
  if (!visit) return openForm("order");
  openForm("order", { visitId: visit.id, clientId: visit.clientId });
});

document.getElementById("visit-sheet-start").addEventListener("click", () => {
  const visit = loadVisits().find((item) => item.id === activeVisitId);
  if (!visit) return;
  const now = new Date();
  const updated = upsertVisit({
    ...visit,
    status: "En curso",
    startAt: now.toISOString(),
    fecha: todayISO(),
    hora: formatTime(now),
  });
  closeVisitSheet();
  openVisitSheet(updated.id);
  render();
});

searchInput.addEventListener("input", () => renderVisits(getSellerVisits()));
salesSearchInput.addEventListener("input", () => renderSales(getSellerOrders()));

document.querySelectorAll(".chip[data-filter]").forEach((chip) => {
  chip.addEventListener("click", () => {
    resultFilter = chip.dataset.filter;
    document.querySelectorAll(".chip[data-filter]").forEach((node) => {
      node.classList.toggle("active", node === chip);
    });
    renderVisits(getSellerVisits());
  });
});

document.querySelectorAll("#sales-chips .chip").forEach((chip) => {
  chip.addEventListener("click", () => {
    salesFilter = chip.dataset.salesFilter;
    document.querySelectorAll("#sales-chips .chip").forEach((node) => {
      node.classList.toggle("active", node === chip);
    });
    renderSales(getSellerOrders());
  });
});

document.querySelectorAll("#inventory-chips .chip").forEach((chip) => {
  chip.addEventListener("click", () => {
    inventoryCategory = chip.dataset.category;
    document.querySelectorAll("#inventory-chips .chip").forEach((node) => {
      node.classList.toggle("active", node === chip);
    });
    renderInventory();
  });
});

document.querySelectorAll("#when-group .segment").forEach((button) => {
  button.addEventListener("click", () => {
    createWhen = button.dataset.value;
    setSegmentGroup("when-group", createWhen);
    syncCreateWhen();
  });
});

document.querySelectorAll("#close-outcome-group .segment").forEach((button) => {
  button.addEventListener("click", () => {
    closeOutcome = button.dataset.value;
    setSegmentGroup("close-outcome-group", closeOutcome);
    syncCloseOutcome();
  });
});

document.querySelectorAll("#close-follow-group .segment").forEach((button) => {
  button.addEventListener("click", () => {
    closeFollowUp = button.dataset.value;
    setSegmentGroup("close-follow-group", closeFollowUp);
    syncCloseOutcome();
  });
});

document.querySelectorAll("#order-status-group .segment").forEach((button) => {
  button.addEventListener("click", () => {
    orderStatus = button.dataset.value;
    setSegmentGroup("order-status-group", orderStatus);
  });
});

document.querySelectorAll("#order-price-group .segment").forEach((button) => {
  button.addEventListener("click", () => {
    orderPriceList = button.dataset.value;
    setSegmentGroup("order-price-group", orderPriceList);
    renderProductList("order-products", orderQty, "order-total", orderPriceList);
  });
});

document.getElementById("create-client-id").addEventListener("change", () => {
  updateClientMeta("create-client-id", "create-client-meta");
  const client = getClient(document.getElementById("create-client-id").value);
  if (client) document.getElementById("create-location").value = client.address;
});

document.getElementById("order-client-id").addEventListener("change", () => {
  updateClientMeta("order-client-id", "order-client-meta");
  fillOrderVisitSelect(document.getElementById("order-visit-id").value, document.getElementById("order-client-id").value);
});

document.getElementById("close-visit-id").addEventListener("change", syncCloseOutcome);

document.getElementById("create-new-client-btn").addEventListener("click", () => {
  formDraft = snapshotForm("create");
  openForm("client", { returnMode: "create" });
});

document.getElementById("order-new-client-btn").addEventListener("click", () => {
  formDraft = snapshotForm("order");
  openForm("client", { returnMode: "order" });
});

document.getElementById("close-open-order-btn").addEventListener("click", () => {
  const visitId = document.getElementById("close-visit-id").value;
  const visit = loadVisits().find((item) => item.id === visitId);
  pendingCloseVisitId = visitId;
  if (!visit) return openForm("order");
  openForm("order", { visitId: visit.id, clientId: visit.clientId });
});

document.getElementById("clear-btn").addEventListener("click", () => {
  clearDemoData();
  seedDemoData();
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
  const clientId = document.getElementById("create-client-id").value;
  const error = document.getElementById("create-client-error");
  if (!clientId) {
    error.classList.remove("hidden");
    return;
  }
  error.classList.add("hidden");

  const client = getClient(clientId);
  const seller = getSeller();
  const now = new Date();
  const later = createWhen === "later";
  const date = later
    ? (document.getElementById("create-date").value || addDaysISO(todayISO(), 1))
    : todayISO();

  const created = upsertVisit({
    status: later ? "Programada" : "En curso",
    clientId,
    estado: client?.estado || "",
    location: document.getElementById("create-location").value.trim() || client?.address || "",
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
    startAt: later ? "" : now.toISOString(),
    hora: later ? "" : formatTime(now),
    vendedorId: seller.id,
    vendedor: seller.name,
    ruta: seller.ruta,
  });

  createForm.reset();
  createWhen = "now";
  setSegmentGroup("when-group", createWhen);
  syncCreateWhen();
  fillClientSelect("create-client-id", "", "create-client-meta");
  resultFilter = later ? "scheduled" : "open";
  if (later) calendarDay = date;
  document.querySelectorAll(".chip[data-filter]").forEach((node) => {
    node.classList.toggle("active", node.dataset.filter === resultFilter);
  });

  if (later) {
    closeForm();
    switchTab("visits");
    return;
  }

  closeForm();
  openVisitSheet(created.id);
  render();
});

closeVisitForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const visitId = document.getElementById("close-visit-id").value;
  if (!visitId) {
    alert("No hay visitas abiertas para cerrar. Crea una visita primero.");
    return;
  }

  const visits = loadVisits();
  const current = visits.find((visit) => visit.id === visitId);
  if (!current) return;

  const now = new Date();
  const notes = document.getElementById("close-notes").value.trim() || current.notes;
  const motive = document.getElementById("close-motive").value;

  upsertVisit({
    ...current,
    status: "Completada",
    outcome: closeOutcome,
    motive,
    followUp: closeFollowUp,
    notes,
    photoUri: pendingPhoto || current.photoUri || "",
    endAt: now.toISOString(),
    startAt: current.startAt || current.createdAt || now.toISOString(),
    hora: current.hora || formatTime(current.startAt || now),
    horaFin: formatTime(now),
    fecha: todayISO(),
  });

  if (closeFollowUp === "schedule") {
    const seller = getSeller();
    const followDate = document.getElementById("close-follow-date").value || addDaysISO(todayISO(), 1);
    upsertVisit({
      status: "Programada",
      clientId: current.clientId,
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

  const shouldOpenOrder = closeOutcome === "con_venta" && !ordersForVisit(visitId).length;
  const clientId = current.clientId;

  closeVisitForm.reset();
  clearClosePhoto();
  closeForm();
  resultFilter = "all";
  document.querySelectorAll(".chip[data-filter]").forEach((node) => {
    node.classList.toggle("active", node.dataset.filter === "all");
  });

  if (shouldOpenOrder) {
    openForm("order", { visitId, clientId });
    return;
  }

  switchTab("visits");
});

orderForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const clientId = document.getElementById("order-client-id").value;
  const error = document.getElementById("order-client-error");
  if (!clientId) {
    error.classList.remove("hidden");
    return;
  }
  error.classList.add("hidden");

  const lines = qtyMapToLines(orderQty, orderPriceList);
  if (orderStatus !== "Borrador" && !lines.length) {
    alert("Selecciona al menos un producto, o guarda como borrador.");
    return;
  }

  const seller = getSeller();
  const now = new Date();
  const visitId = document.getElementById("order-visit-id").value;

  const created = upsertOrder({
    clientId,
    visitId,
    vendedorId: seller.id,
    vendedor: seller.name,
    ruta: seller.ruta,
    status: orderStatus,
    priceList: orderPriceList,
    lines,
    notes: document.getElementById("order-notes").value.trim(),
    createdAt: now.toISOString(),
    fecha: todayISO(),
  });

  if (visitId) {
    const visit = loadVisits().find((item) => item.id === visitId);
    if (visit && visit.status === "Completada" && visit.outcome !== "con_venta") {
      upsertVisit({ ...visit, outcome: "con_venta" });
    }
  }

  orderForm.reset();
  resetQty(orderQty);
  const returnCloseId = pendingCloseVisitId || visitId;
  const returnVisit = returnCloseId ? loadVisits().find((item) => item.id === returnCloseId) : null;
  pendingCloseVisitId = "";
  closeForm();

  if (returnVisit && isOpenVisit(returnVisit)) {
    openForm("close", { visitId: returnVisit.id });
    return;
  }

  alert(`Orden ${created.code} guardada.`);
  salesFilter = "all";
  document.querySelectorAll("#sales-chips .chip").forEach((node) => {
    node.classList.toggle("active", node.dataset.salesFilter === "all");
  });
  switchTab("sales");
});

clientForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const name = document.getElementById("client-name").value.trim();
  const error = document.getElementById("client-name-error");
  if (!name) {
    error.classList.remove("hidden");
    return;
  }
  error.classList.add("hidden");

  const created = upsertClient({
    rif: document.getElementById("client-rif").value.trim(),
    name,
    address: document.getElementById("client-address").value.trim(),
    estado: document.getElementById("client-estado").value,
  });

  const returnTo = clientReturnMode || "create";
  const draft = formDraft
    ? { ...formDraft, clientId: created.id }
    : null;
  clientReturnMode = "";
  formDraft = null;
  if (draft) openForm(returnTo, { clientId: created.id, restore: draft });
  else openForm(returnTo, { clientId: created.id });
});

render();
