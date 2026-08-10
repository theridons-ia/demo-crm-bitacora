const STORAGE_KEY = "demo_crm_visitas";

const form = document.getElementById("visit-form");
const visitsList = document.getElementById("visits-list");
const clearBtn = document.getElementById("clear-btn");

const kpiVisitas = document.getElementById("kpi-visitas");
const kpiVentas = document.getElementById("kpi-ventas");
const kpiEfectividad = document.getElementById("kpi-efectividad");
const pendienteCobro = document.getElementById("pendiente-cobro");

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
          <strong>${seller.name}</strong>
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
    .map((visit) => `
      <li class="item">
        <div class="item-top">
          <strong>${visit.cliente}</strong>
          <span class="badge">${visit.resultado}</span>
        </div>
        <p>${visit.estado} · ${visit.hora} · Venta USD $ ${formatCurrency(visit.monto)}</p>
        ${visit.nota ? `<p>Nota: ${visit.nota}</p>` : ""}
      </li>
    `)
    .join("");

  renderLeaderboard(visits);
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  const formData = new FormData(form);

  const newVisit = {
    cliente: String(formData.get("cliente") || "").trim(),
    estado: String(formData.get("estado") || ""),
    resultado: String(formData.get("resultado") || ""),
    monto: Number(formData.get("monto") || 0),
    nota: String(formData.get("nota") || "").trim(),
    hora: new Date().toLocaleTimeString("es-VE", { hour: "2-digit", minute: "2-digit" }),
  };

  const visits = loadVisits();
  visits.push(newVisit);
  saveVisits(visits);
  form.reset();
  renderVisits();
});

clearBtn.addEventListener("click", () => {
  localStorage.removeItem(STORAGE_KEY);
  renderVisits();
});

renderVisits();
