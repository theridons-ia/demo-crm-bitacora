const screens = {
  team: document.getElementById("sup-screen-team"),
  sellers: document.getElementById("sup-screen-sellers"),
  clients: document.getElementById("sup-screen-clients"),
  charts: document.getElementById("sup-screen-charts"),
  assign: document.getElementById("sup-screen-assign"),
};

const filterFecha = document.getElementById("filter-fecha");
const filterResultado = document.getElementById("filter-resultado");
const leaderboard = document.getElementById("leaderboard");
const teamVisits = document.getElementById("team-visits");
const teamOrders = document.getElementById("team-orders");
const sellerDetail = document.getElementById("seller-detail");
const clientsSearch = document.getElementById("clients-search");

let selectedSellerId = "";
let activityView = "visits";
let assignType = "visit";
let assignQty = Object.fromEntries(PRODUCTS.map((p) => [p.id, 0]));

function switchSupTab(tab) {
  Object.entries(screens).forEach(([key, node]) => {
    node.classList.toggle("active", key === tab);
  });
  document.querySelectorAll(".tab[data-sup-tab]").forEach((button) => {
    button.classList.toggle("active", button.dataset.supTab === tab);
  });
  window.scrollTo({ top: 0, behavior: "smooth" });
  if (tab === "charts") renderCharts();
  if (tab === "sellers") renderSellers();
  if (tab === "clients") renderClients();
  if (tab === "assign") refreshIcons();
  refreshIcons();
}

function syncAssignType() {
  document.getElementById("assign-visit-form").classList.toggle("hidden", assignType !== "visit");
  document.getElementById("assign-order-form").classList.toggle("hidden", assignType !== "order");
  document.querySelectorAll("#assign-type-group .segment").forEach((button) => {
    button.classList.toggle("active", button.dataset.value === assignType);
  });
}

function syncActivityView() {
  teamVisits.classList.toggle("hidden", activityView !== "visits");
  teamOrders.classList.toggle("hidden", activityView !== "orders");
  document.querySelectorAll("#activity-chips .chip").forEach((chip) => {
    chip.classList.toggle("active", chip.dataset.activity === activityView);
  });
}

function currentFilters() {
  return {
    fecha: filterFecha.value || "",
    resultado: filterResultado.value || "",
  };
}

function applyVisitFilters(visits) {
  const filters = currentFilters();
  return visits.filter((visit) => {
    if (filters.fecha && visit.fecha !== filters.fecha) return false;
    if (filters.resultado && visit.outcome !== filters.resultado) return false;
    return true;
  });
}

function fillSellerSelects() {
  const html = SELLERS.map((seller) =>
    `<option value="${escapeHtml(seller.id)}">${escapeHtml(seller.name)}</option>`
  ).join("");
  document.getElementById("assign-visit-seller").innerHTML = html;
  document.getElementById("assign-order-seller").innerHTML = html;
}

function fillClientSelects() {
  const clients = loadClients().slice().sort((a, b) => a.name.localeCompare(b.name, "es"));
  const html = clients.map((client) =>
    `<option value="${escapeHtml(client.id)}">${escapeHtml(client.name)} · ${escapeHtml(client.rif)}</option>`
  ).join("");
  document.getElementById("assign-visit-client").innerHTML = html;
  document.getElementById("assign-order-client").innerHTML = html;
}

function qtyMapTotal(qtyMap) {
  return PRODUCTS.reduce((sum, product) => sum + product.listPrice * Number(qtyMap[product.id] || 0), 0);
}

function qtyMapToLines(qtyMap) {
  return PRODUCTS
    .filter((product) => Number(qtyMap[product.id] || 0) > 0)
    .map((product) => ({
      productId: product.id,
      code: product.code,
      name: product.name,
      unitPrice: product.listPrice,
      qty: Number(qtyMap[product.id]),
    }));
}

function resetQty() {
  PRODUCTS.forEach((product) => {
    assignQty[product.id] = 0;
  });
}

function renderAssignProducts() {
  const container = document.getElementById("assign-order-products");
  container.innerHTML = PRODUCTS.map((product) => `
    <div class="product-row" data-product="${product.id}">
      <img class="product-thumb" src="${escapeHtml(product.image)}" alt="" width="44" height="44">
      <div class="product-copy">
        <strong>${escapeHtml(product.name)}</strong>
        <p>${escapeHtml(product.code)} · $${formatCurrency(product.listPrice)}</p>
      </div>
      <div class="stepper">
        <button type="button" data-step="-1" aria-label="Menos">−</button>
        <span>${assignQty[product.id] || 0}</span>
        <button type="button" data-step="1" aria-label="Más">+</button>
      </div>
    </div>
  `).join("");

  container.querySelectorAll(".product-row").forEach((row) => {
    const productId = row.dataset.product;
    row.querySelectorAll("[data-step]").forEach((button) => {
      button.addEventListener("click", () => {
        assignQty[productId] = Math.max(0, Number(assignQty[productId] || 0) + Number(button.dataset.step));
        renderAssignProducts();
      });
    });
  });

  document.getElementById("assign-order-total").textContent = `$${formatCurrency(qtyMapTotal(assignQty))}`;
}

function groupBySeller(visits, orders) {
  const map = new Map();
  SELLERS.forEach((seller) => {
    map.set(seller.id, {
      id: seller.id,
      name: seller.name,
      initials: seller.initials,
      ruta: seller.ruta,
      visits: [],
      orders: [],
    });
  });

  visits.forEach((visit) => {
    const id = visit.vendedorId || "unknown";
    if (!map.has(id)) {
      map.set(id, {
        id,
        name: visit.vendedor || "Sin asignar",
        initials: "?",
        ruta: visit.ruta || "Sin ruta",
        visits: [],
        orders: [],
      });
    }
    map.get(id).visits.push(visit);
  });

  orders.forEach((order) => {
    const id = order.vendedorId || "unknown";
    if (!map.has(id)) {
      map.set(id, {
        id,
        name: order.vendedor || "Sin asignar",
        initials: "?",
        ruta: order.ruta || "Sin ruta",
        visits: [],
        orders: [],
      });
    }
    map.get(id).orders.push(order);
  });

  return [...map.values()]
    .map((seller) => ({
      ...seller,
      ...summarizeVisits(seller.visits, seller.orders),
      sales: seller.orders.reduce((sum, order) => sum + Number(order.amount || 0), 0),
    }))
    .sort((a, b) => b.sales - a.sales);
}

function renderBarList(containerId, rows) {
  const max = Math.max(...rows.map((row) => row.value), 1);
  const container = document.getElementById(containerId);
  if (!rows.length) {
    container.innerHTML = `<p class="hint">Sin datos para graficar.</p>`;
    return;
  }
  container.innerHTML = rows.map((row) => `
    <div class="bar-item">
      <div class="bar-item-top">
        <span>${escapeHtml(row.label)}</span>
        <strong>${escapeHtml(row.display)}</strong>
      </div>
      <div class="bar-track">
        <div class="bar-fill ${row.dark ? "dark" : ""}" style="width:${Math.max(6, (row.value / max) * 100)}%"></div>
      </div>
    </div>
  `).join("");
}

function renderCharts() {
  const visits = loadVisits();
  const orders = loadOrders();
  const completed = completedVisits(visits);
  const salesTotal = orders.reduce((sum, order) => sum + Number(order.amount || 0), 0);
  const ticket = orders.length ? Math.round(salesTotal / orders.length) : 0;
  const conversion = completed.length
    ? Math.round((completed.filter((visit) => visit.outcome === "con_venta").length / completed.length) * 100)
    : 0;

  document.getElementById("chart-ticket").textContent = `$${formatCurrency(ticket)}`;
  document.getElementById("chart-conversion").textContent = `${conversion}%`;
  document.getElementById("chart-cobranza").textContent = `$${formatCurrency(salesTotal * 0.3)}`;

  const bySeller = groupBySeller(visits, orders)
    .filter((seller) => seller.sales > 0 || seller.visits.length)
    .map((seller) => ({
      label: seller.name.split(" ")[0],
      value: seller.sales,
      display: `$${formatCurrency(seller.sales)}`,
    }));
  renderBarList("chart-sales-sellers", bySeller);

  const withSale = completed.filter((visit) => visit.outcome === "con_venta").length;
  const withoutSale = completed.filter((visit) => visit.outcome === "sin_venta").length;
  const open = visits.filter((visit) => visit.status === "En curso").length;
  const scheduled = visits.filter((visit) => visit.status === "Programada").length;
  renderBarList("chart-visit-outcomes", [
    { label: "Con venta", value: withSale, display: String(withSale) },
    { label: "Sin venta", value: withoutSale, display: String(withoutSale), dark: true },
    { label: "En curso", value: open, display: String(open) },
    { label: "Agenda", value: scheduled, display: String(scheduled) },
  ]);

  const statusCount = { Confirmada: 0, Parcial: 0, Borrador: 0 };
  orders.forEach((order) => {
    statusCount[order.status] = (statusCount[order.status] || 0) + 1;
  });
  renderBarList("chart-order-status", [
    { label: "Confirmadas", value: statusCount.Confirmada, display: String(statusCount.Confirmada) },
    { label: "Parciales", value: statusCount.Parcial, display: String(statusCount.Parcial) },
    { label: "Borradores", value: statusCount.Borrador, display: String(statusCount.Borrador), dark: true },
  ]);

  const productMap = new Map();
  orders.forEach((order) => {
    (order.lines || []).forEach((line) => {
      const current = productMap.get(line.productId) || { name: line.name, qty: 0, amount: 0 };
      current.qty += Number(line.qty || 0);
      current.amount += Number(line.total || line.qty * line.unitPrice || 0);
      productMap.set(line.productId, current);
    });
  });
  const topProducts = [...productMap.values()]
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 5)
    .map((product) => ({
      label: product.name,
      value: product.amount,
      display: `${product.qty} u · $${formatCurrency(product.amount)}`,
    }));
  renderBarList("chart-top-products", topProducts);
}

function renderSellers() {
  const visits = loadVisits();
  const orders = loadOrders();
  const sellers = groupBySeller(visits, orders);
  document.getElementById("sellers-count").textContent = `${SELLERS.length} vendedores en la fuerza de campo`;

  document.getElementById("sellers-list").innerHTML = sellers.map((seller) => `
    <button class="visit-card visit-card-btn seller-card-btn" type="button" data-profile="${escapeHtml(seller.id)}">
      <div class="visit-icon seller-avatar-sm" aria-hidden="true">${escapeHtml(seller.initials || "?")}</div>
      <div class="visit-body">
        <div class="visit-row">
          <h3>${escapeHtml(seller.name)}</h3>
          <strong class="visit-amount">$${formatCurrency(seller.sales)}</strong>
        </div>
        <p class="meta">${escapeHtml(seller.ruta)}</p>
        <p class="notes">${seller.visits.length} visitas · ${seller.orders.length} órdenes · ${seller.effectiveness}% efectividad</p>
      </div>
    </button>
  `).join("");

  document.querySelectorAll("[data-profile]").forEach((node) => {
    node.addEventListener("click", () => openSellerProfile(node.dataset.profile));
  });
  refreshIcons();
}

function openSellerProfile(sellerId) {
  const seller = SELLERS.find((item) => item.id === sellerId) || groupBySeller(loadVisits(), loadOrders()).find((item) => item.id === sellerId);
  if (!seller) return;

  const visits = loadVisits().filter((visit) => visit.vendedorId === sellerId);
  const orders = loadOrders().filter((order) => order.vendedorId === sellerId);
  const completed = completedVisits(visits);
  const sales = orders.reduce((sum, order) => sum + Number(order.amount || 0), 0);
  const withSale = completed.filter((visit) => visit.outcome === "con_venta").length;
  const withoutSale = completed.filter((visit) => visit.outcome === "sin_venta").length;
  const open = visits.filter((visit) => visit.status === "En curso").length;
  const scheduled = visits.filter((visit) => visit.status === "Programada").length;
  const durations = completed.map(visitDurationMinutes).filter((value) => value != null);
  const avgMinutes = durations.length
    ? Math.round(durations.reduce((sum, value) => sum + value, 0) / durations.length)
    : 0;
  const ticket = orders.length ? Math.round(sales / orders.length) : 0;
  const cobranza = Math.round(sales * 0.3);
  const conversion = completed.length ? Math.round((withSale / completed.length) * 100) : 0;
  const base = SELLERS.find((item) => item.id === sellerId);

  const content = document.getElementById("seller-profile-content");
  content.innerHTML = `
    <div class="seller-hero">
      <div class="seller-hero-avatar">${escapeHtml(base?.initials || seller.initials || "?")}</div>
      <div>
        <h2 id="profile-name">${escapeHtml(base?.name || seller.name)}</h2>
        <p>${escapeHtml(base?.ruta || seller.ruta || "Sin ruta")}</p>
        <div class="seller-hero-meta">
          <span class="seller-chip"><i data-lucide="badge-check"></i> Activo</span>
          <span class="seller-chip"><i data-lucide="map-pinned"></i> ${escapeHtml((base?.ruta || "").split("·")[0].trim() || "Ruta")}</span>
        </div>
      </div>
    </div>

    <div class="profile-metrics">
      <article class="profile-metric">
        <div class="metric-label"><i data-lucide="shopping-cart"></i> Ventas</div>
        <strong>$${formatCurrency(sales)}</strong>
        <em>${orders.length} órdenes</em>
      </article>
      <article class="profile-metric">
        <div class="metric-label"><i data-lucide="route"></i> Visitas</div>
        <strong>${visits.length}</strong>
        <em>${completed.length} completadas</em>
      </article>
      <article class="profile-metric">
        <div class="metric-label"><i data-lucide="wallet"></i> Cobranza</div>
        <strong>$${formatCurrency(cobranza)}</strong>
        <em>30% estimado</em>
      </article>
      <article class="profile-metric">
        <div class="metric-label"><i data-lucide="timer"></i> Tiempo medio</div>
        <strong>${avgMinutes || "—"} min</strong>
        <em>por visita cerrada</em>
      </article>
      <article class="profile-metric">
        <div class="metric-label"><i data-lucide="receipt"></i> Ticket</div>
        <strong>$${formatCurrency(ticket)}</strong>
        <em>promedio por orden</em>
      </article>
      <article class="profile-metric">
        <div class="metric-label"><i data-lucide="percent"></i> Conversión</div>
        <strong>${conversion}%</strong>
        <em>visitas con venta</em>
      </article>
    </div>

    <section class="card chart-card">
      <h2>Resultado de visitas</h2>
      <div class="bar-list">
        ${renderInlineBars([
          { label: "Con venta", value: withSale, display: String(withSale) },
          { label: "Sin venta", value: withoutSale, display: String(withoutSale), dark: true },
          { label: "En curso", value: open, display: String(open) },
          { label: "Agenda", value: scheduled, display: String(scheduled) },
        ])}
      </div>
    </section>

    <section class="card chart-card">
      <h2>Financiero</h2>
      <div class="bar-list">
        ${renderInlineBars([
          { label: "Ventas netas", value: sales, display: `$${formatCurrency(sales)}` },
          { label: "Cobranza pend.", value: cobranza, display: `$${formatCurrency(cobranza)}`, dark: true },
          { label: "Ticket promedio", value: ticket, display: `$${formatCurrency(ticket)}` },
        ])}
      </div>
    </section>

    <section class="card chart-card">
      <h2>Órdenes recientes</h2>
      <div class="visits-stack">
        ${orders.length
          ? orders.slice(0, 4).map((order) => renderOrderCard(order)).join("")
          : `<div class="empty"><h3>Sin órdenes</h3><p>Este vendedor aún no tiene pedidos.</p></div>`}
      </div>
    </section>
  `;

  document.getElementById("seller-profile-sheet").classList.remove("hidden");
  refreshIcons(content);
}

function closeSellerProfile() {
  document.getElementById("seller-profile-sheet").classList.add("hidden");
}

function renderInlineBars(rows) {
  const max = Math.max(...rows.map((row) => row.value), 1);
  return rows.map((row) => `
    <div class="bar-item">
      <div class="bar-item-top">
        <span>${escapeHtml(row.label)}</span>
        <strong>${escapeHtml(row.display)}</strong>
      </div>
      <div class="bar-track">
        <div class="bar-fill ${row.dark ? "dark" : ""}" style="width:${Math.max(6, (row.value / max) * 100)}%"></div>
      </div>
    </div>
  `).join("");
}

function renderClients() {
  const query = (clientsSearch.value || "").trim().toLowerCase();
  const orders = loadOrders();
  const visits = loadVisits();
  const clients = loadClients()
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name, "es"))
    .filter((client) => {
      if (!query) return true;
      return `${client.rif} ${client.name} ${client.address} ${client.estado}`.toLowerCase().includes(query);
    });

  document.getElementById("clients-count").textContent = `${loadClients().length} clientes en cartera`;
  document.getElementById("clients-list").innerHTML = clients.length
    ? clients.map((client) => {
      const clientOrders = orders.filter((order) => order.clientId === client.id);
      const clientVisits = visits.filter((visit) => visit.clientId === client.id);
      const sales = clientOrders.reduce((sum, order) => sum + Number(order.amount || 0), 0);
      return `
        <article class="visit-card">
          <div class="visit-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M3 7h18M6 7V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v2M6 7l1.2 12h9.6L18 7"/>
            </svg>
          </div>
          <div class="visit-body">
            <div class="visit-row">
              <h3>${escapeHtml(client.name)}</h3>
              <strong class="visit-amount">$${formatCurrency(sales)}</strong>
            </div>
            <p class="meta">${escapeHtml(client.rif)} · ${escapeHtml(client.estado || "Sin zona")}</p>
            <p class="notes">${escapeHtml(client.address)} · ${clientVisits.length} visitas · ${clientOrders.length} órdenes</p>
          </div>
        </article>
      `;
    }).join("")
    : `<div class="empty"><h3>Sin clientes</h3><p>No hay coincidencias con la búsqueda.</p></div>`;
}

function renderTeam() {
  const visits = applyVisitFilters(loadVisits())
    .slice()
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  const orders = loadOrders()
    .filter((order) => !filterFecha.value || order.fecha === filterFecha.value)
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  const summary = summarizeVisits(visits, orders);
  const sellers = groupBySeller(visits, orders).filter((seller) => seller.visits.length || seller.orders.length);
  const salesTotal = orders.reduce((sum, order) => sum + Number(order.amount || 0), 0);

  document.getElementById("kpi-vendedores").textContent = SELLERS.length;
  document.getElementById("kpi-visitas").textContent = summary.visits + summary.inProgress + summary.scheduled;
  document.getElementById("kpi-ventas").textContent = `$${formatCurrency(salesTotal)}`;
  document.getElementById("kpi-efectividad").textContent = `${summary.effectiveness}%`;
  document.getElementById("pendiente-cobro").textContent =
    `Cobranza pendiente: $${formatCurrency(salesTotal * 0.3)}`;

  if (!sellers.length) {
    leaderboard.innerHTML = `
      <div class="empty">
        <h3>Sin actividad del equipo</h3>
        <p>Asigna una visita o carga datos demo.</p>
      </div>
    `;
  } else {
    leaderboard.innerHTML = sellers.map((seller) => `
      <button class="visit-card visit-card-btn" type="button" data-seller="${escapeHtml(seller.id)}">
        <div class="visit-icon seller-avatar-sm" aria-hidden="true">${escapeHtml(seller.initials || "?")}</div>
        <div class="visit-body">
          <div class="visit-row">
            <h3>${escapeHtml(seller.name)}</h3>
            <strong class="visit-amount">$${formatCurrency(seller.sales)}</strong>
          </div>
          <p class="meta">${escapeHtml(seller.ruta)}</p>
          <p class="notes">${seller.visits.length} visitas · ${seller.orders.length} órdenes · ${seller.effectiveness}% ef.</p>
        </div>
      </button>
    `).join("");

    leaderboard.querySelectorAll("[data-seller]").forEach((node) => {
      node.addEventListener("click", () => {
        showSeller(node.dataset.seller);
        openSellerProfile(node.dataset.seller);
      });
    });
  }

  teamVisits.innerHTML = visits.length
    ? visits.slice(0, 12).map((visit) => renderVisitCard(visit)).join("")
    : `<div class="empty"><h3>Sin visitas</h3><p>No hay registros con estos filtros.</p></div>`;

  teamOrders.innerHTML = orders.length
    ? orders.slice(0, 12).map((order) => renderOrderCard(order)).join("")
    : `<div class="empty"><h3>Sin órdenes</h3><p>Asigna una orden o espera actividad del equipo.</p></div>`;

  if (selectedSellerId) showSeller(selectedSellerId);
  else sellerDetail.classList.add("hidden");

  syncActivityView();
  renderSellers();
  renderClients();
  renderCharts();
  refreshIcons();
}

function showSeller(sellerId) {
  selectedSellerId = sellerId;
  const seller = SELLERS.find((item) => item.id === sellerId);
  const visits = applyVisitFilters(loadVisits())
    .filter((visit) => visit.vendedorId === sellerId)
    .sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
  const orders = loadOrders().filter((order) =>
    order.vendedorId === sellerId && (!filterFecha.value || order.fecha === filterFecha.value)
  );
  const summary = summarizeVisits(visits, orders);
  const sales = orders.reduce((sum, order) => sum + Number(order.amount || 0), 0);

  sellerDetail.classList.remove("hidden");
  document.getElementById("seller-title").textContent = seller?.name || visits[0]?.vendedor || "Vendedor";
  document.getElementById("seller-ruta").textContent = seller?.ruta || visits[0]?.ruta || "Sin ruta";
  document.getElementById("seller-visitas").textContent = visits.length;
  document.getElementById("seller-ventas").textContent = `$${formatCurrency(sales)}`;
  document.getElementById("seller-efectividad").textContent = `${summary.effectiveness}%`;
  document.getElementById("seller-pendiente").textContent = `$${formatCurrency(sales * 0.3)}`;
  document.getElementById("seller-visits").innerHTML = [
    ...visits.map((visit) => renderVisitCard(visit)),
    ...orders.slice(0, 5).map((order) => renderOrderCard(order)),
  ].join("") || `<div class="empty"><h3>Sin actividad</h3><p>Este vendedor no tiene registros con el filtro actual.</p></div>`;

  sellerDetail.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

filterFecha.value = todayISO();
document.getElementById("assign-visit-date").value = addDaysISO(todayISO(), 1);
fillSellerSelects();
fillClientSelects();
renderAssignProducts();
syncAssignType();
syncActivityView();

if (!loadVisits().length && !loadOrders().length) seedDemoData();

document.querySelectorAll(".tab[data-sup-tab]").forEach((button) => {
  button.addEventListener("click", () => switchSupTab(button.dataset.supTab));
});

document.querySelectorAll("#activity-chips .chip").forEach((chip) => {
  chip.addEventListener("click", () => {
    activityView = chip.dataset.activity;
    syncActivityView();
  });
});

document.querySelectorAll("#assign-type-group .segment").forEach((button) => {
  button.addEventListener("click", () => {
    assignType = button.dataset.value;
    syncAssignType();
  });
});

clientsSearch.addEventListener("input", renderClients);

[filterFecha, filterResultado].forEach((input) => {
  input.addEventListener("change", renderTeam);
});

document.getElementById("reset-filters-btn").addEventListener("click", () => {
  filterFecha.value = todayISO();
  filterResultado.value = "";
  selectedSellerId = "";
  renderTeam();
});

document.getElementById("seed-btn").addEventListener("click", () => {
  seedDemoData();
  fillClientSelects();
  selectedSellerId = "";
  renderTeam();
});

document.getElementById("clear-btn").addEventListener("click", () => {
  clearDemoData();
  fillClientSelects();
  selectedSellerId = "";
  renderTeam();
});

document.getElementById("close-seller-btn").addEventListener("click", () => {
  selectedSellerId = "";
  sellerDetail.classList.add("hidden");
});

document.getElementById("seller-profile-backdrop").addEventListener("click", closeSellerProfile);
document.getElementById("close-profile-btn").addEventListener("click", closeSellerProfile);

document.getElementById("assign-visit-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const seller = getSeller(document.getElementById("assign-visit-seller").value);
  const client = getClient(document.getElementById("assign-visit-client").value);
  const date = document.getElementById("assign-visit-date").value || addDaysISO(todayISO(), 1);
  if (!client) {
    alert("Selecciona un cliente.");
    return;
  }

  upsertVisit({
    status: "Programada",
    clientId: client.id,
    estado: client.estado,
    location: client.address,
    notes: document.getElementById("assign-visit-notes").value.trim() || "Visita asignada por supervisor",
    fecha: date,
    scheduledDate: date,
    createdAt: new Date().toISOString(),
    vendedorId: seller.id,
    vendedor: seller.name,
    ruta: seller.ruta,
  });

  document.getElementById("assign-visit-notes").value = "";
  renderTeam();
  switchSupTab("team");
  activityView = "visits";
  syncActivityView();
  alert(`Visita programada para ${seller.name}`);
});

document.getElementById("assign-order-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const seller = getSeller(document.getElementById("assign-order-seller").value);
  const client = getClient(document.getElementById("assign-order-client").value);
  if (!client) {
    alert("Selecciona un cliente.");
    return;
  }

  const lines = qtyMapToLines(assignQty);
  const created = upsertOrder({
    clientId: client.id,
    vendedorId: seller.id,
    vendedor: seller.name,
    ruta: seller.ruta,
    lines,
    status: lines.length ? "Confirmada" : "Borrador",
    notes: document.getElementById("assign-order-notes").value.trim() || "Orden asignada por supervisor",
    createdAt: new Date().toISOString(),
    fecha: todayISO(),
  });

  document.getElementById("assign-order-notes").value = "";
  resetQty();
  renderAssignProducts();
  renderTeam();
  switchSupTab("team");
  activityView = "orders";
  syncActivityView();
  alert(`Orden ${created.code} asignada a ${seller.name}`);
});

renderTeam();
