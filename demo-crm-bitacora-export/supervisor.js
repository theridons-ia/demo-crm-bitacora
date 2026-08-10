const filterFecha = document.getElementById("filter-fecha");
const filterEstado = document.getElementById("filter-estado");
const filterResultado = document.getElementById("filter-resultado");
const resetFiltersBtn = document.getElementById("reset-filters-btn");
const seedBtn = document.getElementById("seed-btn");
const clearBtn = document.getElementById("clear-btn");
const leaderboard = document.getElementById("leaderboard");
const teamVisits = document.getElementById("team-visits");
const viewTeam = document.getElementById("view-team");
const viewSeller = document.getElementById("view-seller");
const backTeamBtn = document.getElementById("back-team-btn");

const kpiVendedores = document.getElementById("kpi-vendedores");
const kpiVisitas = document.getElementById("kpi-visitas");
const kpiVentas = document.getElementById("kpi-ventas");
const kpiEfectividad = document.getElementById("kpi-efectividad");
const pendienteCobro = document.getElementById("pendiente-cobro");

let selectedSeller = "";

function fillSelect(select, values, placeholder) {
  select.innerHTML = `<option value="">${placeholder}</option>` +
    values.map((value) => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`).join("");
}

function currentFilters() {
  return {
    fecha: filterFecha.value || "",
    estado: filterEstado.value || "",
    resultado: filterResultado.value || "",
  };
}

function showTeam() {
  selectedSeller = "";
  viewTeam.classList.remove("hidden");
  viewSeller.classList.add("hidden");
  renderTeam();
}

function showSeller(name) {
  selectedSeller = name;
  viewTeam.classList.add("hidden");
  viewSeller.classList.remove("hidden");
  renderSeller();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function renderTeam() {
  const visits = filterVisits(loadVisits(), currentFilters());
  const summary = summarizeVisits(visits);
  const sellers = groupBySeller(visits);

  kpiVendedores.textContent = sellers.length;
  kpiVisitas.textContent = summary.visits;
  kpiVentas.textContent = `$ ${formatCurrency(summary.sales)}`;
  kpiEfectividad.textContent = `${summary.effectiveness}%`;
  pendienteCobro.textContent = `Cobranza pendiente: $ ${formatCurrency(summary.pending)}`;

  if (!sellers.length) {
    leaderboard.innerHTML = '<p class="empty">Sin actividad del equipo para estos filtros. Usa “Cargar datos demo”.</p>';
  } else {
    leaderboard.innerHTML = sellers
      .map((seller) => `
        <li class="item clickable" data-seller="${escapeHtml(seller.name)}">
          <div class="item-top">
            <strong>${escapeHtml(seller.name)}</strong>
            <strong>$ ${formatCurrency(seller.sales)}</strong>
          </div>
          <p>${escapeHtml(seller.ruta)} · ${seller.visits} visitas · ${seller.effectiveness}% efectividad</p>
          <p class="meta">Toca para ver detalle de ruta</p>
        </li>
      `)
      .join("");

    leaderboard.querySelectorAll("[data-seller]").forEach((node) => {
      node.addEventListener("click", () => showSeller(node.dataset.seller));
    });
  }

  if (!visits.length) {
    teamVisits.innerHTML = '<p class="empty">No hay visitas registradas con estos filtros.</p>';
    return;
  }

  teamVisits.innerHTML = visits
    .slice()
    .sort((a, b) => `${b.fecha}${b.hora}`.localeCompare(`${a.fecha}${a.hora}`))
    .slice(0, 12)
    .map((visit) => renderVisitItem(visit, { showSeller: true }))
    .join("");
}

function renderSeller() {
  const sellerMeta = SELLERS.find((item) => item.name === selectedSeller);
  const visits = filterVisits(loadVisits(), {
    ...currentFilters(),
    vendedor: selectedSeller,
  })
    .slice()
    .sort((a, b) => `${a.fecha}${a.hora}`.localeCompare(`${b.fecha}${b.hora}`));
  const summary = summarizeVisits(visits);

  document.getElementById("seller-title").textContent = selectedSeller;
  document.getElementById("seller-sub").textContent =
    "Detalle por vendedor/ruta según filtros del panel.";
  document.getElementById("seller-ruta").textContent =
    sellerMeta?.ruta || visits[0]?.ruta || "Sin ruta";
  document.getElementById("seller-visitas").textContent = summary.visits;
  document.getElementById("seller-ventas").textContent = `$ ${formatCurrency(summary.sales)}`;
  document.getElementById("seller-efectividad").textContent = `${summary.effectiveness}%`;
  document.getElementById("seller-pendiente").textContent = `$ ${formatCurrency(summary.pending)}`;

  const list = document.getElementById("seller-visits");
  if (!visits.length) {
    list.innerHTML = '<p class="empty">Este vendedor no tiene visitas con los filtros actuales.</p>';
    return;
  }

  list.innerHTML = visits.map((visit) => renderVisitItem(visit)).join("");
}

function renderAll() {
  if (selectedSeller) renderSeller();
  else renderTeam();
}

fillSelect(filterEstado, ESTADOS, "Todos");
fillSelect(filterResultado, RESULTADOS, "Todos");
filterFecha.value = todayISO();

[filterFecha, filterEstado, filterResultado].forEach((input) => {
  input.addEventListener("change", renderAll);
});

resetFiltersBtn.addEventListener("click", () => {
  filterFecha.value = todayISO();
  filterEstado.value = "";
  filterResultado.value = "";
  renderAll();
});

seedBtn.addEventListener("click", () => {
  seedDemoVisits();
  showTeam();
});

clearBtn.addEventListener("click", () => {
  clearVisits();
  showTeam();
});

backTeamBtn.addEventListener("click", showTeam);

renderTeam();
