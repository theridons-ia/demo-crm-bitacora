const filterFecha = document.getElementById("filter-fecha");
const filterResultado = document.getElementById("filter-resultado");
const leaderboard = document.getElementById("leaderboard");
const teamVisits = document.getElementById("team-visits");
const sellerDetail = document.getElementById("seller-detail");

let selectedSellerId = "";

function currentFilters() {
  return {
    fecha: filterFecha.value || "",
    resultado: filterResultado.value || "",
  };
}

function applyFilters(visits) {
  const filters = currentFilters();
  return visits.filter((visit) => {
    if (filters.fecha && visit.fecha !== filters.fecha) return false;
    if (filters.resultado && visit.result !== filters.resultado) return false;
    return true;
  });
}

function groupBySeller(visits) {
  const map = new Map();
  visits.forEach((visit) => {
    const id = visit.vendedorId || "unknown";
    if (!map.has(id)) {
      const seller = SELLERS.find((item) => item.id === id);
      map.set(id, {
        id,
        name: visit.vendedor || seller?.name || "Sin asignar",
        ruta: visit.ruta || seller?.ruta || "Sin ruta",
        visits: [],
      });
    }
    map.get(id).visits.push(visit);
  });

  return [...map.values()]
    .map((seller) => ({ ...seller, ...summarizeVisits(seller.visits) }))
    .sort((a, b) => b.sales - a.sales);
}

function renderTeam() {
  const visits = applyFilters(loadVisits())
    .slice()
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  const summary = summarizeVisits(visits);
  const sellers = groupBySeller(visits);

  document.getElementById("kpi-vendedores").textContent = sellers.length;
  document.getElementById("kpi-visitas").textContent = summary.visits;
  document.getElementById("kpi-ventas").textContent = `$${formatCurrency(summary.sales)}`;
  document.getElementById("kpi-efectividad").textContent = `${summary.effectiveness}%`;
  document.getElementById("pendiente-cobro").textContent =
    `Cobranza pendiente: $${formatCurrency(summary.sales * 0.3)}`;

  if (!sellers.length) {
    leaderboard.innerHTML = `
      <div class="empty">
        <h3>Sin actividad del equipo</h3>
        <p>Carga datos demo o registra visitas desde el panel del vendedor.</p>
      </div>
    `;
  } else {
    leaderboard.innerHTML = sellers.map((seller) => `
      <button class="visit-card" type="button" data-seller="${escapeHtml(seller.id)}" style="width:100%; text-align:left">
        <div class="visit-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
          </svg>
        </div>
        <div class="visit-body">
          <div class="visit-row">
            <h3>${escapeHtml(seller.name)}</h3>
            <strong class="visit-amount">$${formatCurrency(seller.sales)}</strong>
          </div>
          <p class="meta">${escapeHtml(seller.ruta)} · ${seller.visits} visitas · ${seller.effectiveness}% efectividad</p>
          <p class="notes">Toca para ver detalle de ruta</p>
        </div>
      </button>
    `).join("");

    leaderboard.querySelectorAll("[data-seller]").forEach((node) => {
      node.addEventListener("click", () => showSeller(node.dataset.seller));
    });
  }

  teamVisits.innerHTML = visits.length
    ? visits.slice(0, 10).map((visit) => renderVisitCard(visit)).join("")
    : `<div class="empty"><h3>Sin visitas</h3><p>No hay registros con estos filtros.</p></div>`;

  if (selectedSellerId) showSeller(selectedSellerId);
  else sellerDetail.classList.add("hidden");
}

function showSeller(sellerId) {
  selectedSellerId = sellerId;
  const seller = SELLERS.find((item) => item.id === sellerId);
  const visits = applyFilters(loadVisits())
    .filter((visit) => visit.vendedorId === sellerId)
    .sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
  const summary = summarizeVisits(visits);

  sellerDetail.classList.remove("hidden");
  document.getElementById("seller-title").textContent = seller?.name || visits[0]?.vendedor || "Vendedor";
  document.getElementById("seller-ruta").textContent = seller?.ruta || visits[0]?.ruta || "Sin ruta";
  document.getElementById("seller-visitas").textContent = summary.visits;
  document.getElementById("seller-ventas").textContent = `$${formatCurrency(summary.sales)}`;
  document.getElementById("seller-efectividad").textContent = `${summary.effectiveness}%`;
  document.getElementById("seller-pendiente").textContent = `$${formatCurrency(summary.sales * 0.3)}`;
  document.getElementById("seller-visits").innerHTML = visits.length
    ? visits.map((visit) => renderVisitCard(visit)).join("")
    : `<div class="empty"><h3>Sin visitas</h3><p>Este vendedor no tiene actividad con los filtros actuales.</p></div>`;
}

filterFecha.value = todayISO();

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
  seedDemoVisits();
  selectedSellerId = "";
  renderTeam();
});

document.getElementById("clear-btn").addEventListener("click", () => {
  clearVisits();
  selectedSellerId = "";
  renderTeam();
});

document.getElementById("close-seller-btn").addEventListener("click", () => {
  selectedSellerId = "";
  sellerDetail.classList.add("hidden");
});

renderTeam();
