const form = document.getElementById("visit-form");
const visitsList = document.getElementById("visits-list");
const clearBtn = document.getElementById("clear-btn");
const seedBtn = document.getElementById("seed-btn");
const gpsBtn = document.getElementById("gps-btn");
const fotoInput = document.getElementById("foto");
const fotoPreview = document.getElementById("foto-preview");
const direccionInput = document.getElementById("direccion");
const latInput = document.getElementById("lat");
const lngInput = document.getElementById("lng");
const gpsStatus = document.getElementById("gps-status");

const vendedorActivo = document.getElementById("vendedor-activo");
const rutaActiva = document.getElementById("ruta-activa");
const filterFecha = document.getElementById("filter-fecha");
const filterEstado = document.getElementById("filter-estado");
const filterResultado = document.getElementById("filter-resultado");
const resetFiltersBtn = document.getElementById("reset-filters-btn");
const openDetailBtn = document.getElementById("open-detail-btn");
const backHomeBtn = document.getElementById("back-home-btn");
const viewHome = document.getElementById("view-home");
const viewDetail = document.getElementById("view-detail");

const kpiVisitas = document.getElementById("kpi-visitas");
const kpiVentas = document.getElementById("kpi-ventas");
const kpiEfectividad = document.getElementById("kpi-efectividad");
const kpiPendiente = document.getElementById("kpi-pendiente");

const estadoSelect = document.getElementById("estado");
const resultadoSelect = document.getElementById("resultado");

let pendingFoto = "";

function fillSelect(select, values, placeholder) {
  select.innerHTML = `<option value="">${placeholder}</option>` +
    values.map((value) => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`).join("");
}

function initControls() {
  vendedorActivo.innerHTML = SELLERS.map(
    (seller) => `<option value="${escapeHtml(seller.name)}">${escapeHtml(seller.name)}</option>`
  ).join("");

  fillSelect(estadoSelect, ESTADOS, "Estado");
  fillSelect(resultadoSelect, RESULTADOS, "Resultado");
  fillSelect(filterEstado, ESTADOS, "Todos");
  fillSelect(filterResultado, RESULTADOS, "Todos");

  filterFecha.value = todayISO();
  syncRuta();
}

function syncRuta() {
  const seller = SELLERS.find((item) => item.name === vendedorActivo.value) || SELLERS[0];
  rutaActiva.value = seller.ruta;
}

function currentFilters() {
  return {
    fecha: filterFecha.value || "",
    estado: filterEstado.value || "",
    resultado: filterResultado.value || "",
    vendedor: vendedorActivo.value || "",
  };
}

function setGpsStatus(message, isError = false) {
  gpsStatus.textContent = message;
  gpsStatus.classList.toggle("error", isError);
}

function clearFotoPreview() {
  pendingFoto = "";
  fotoPreview.innerHTML = "";
  fotoPreview.classList.add("hidden");
  fotoInput.value = "";
}

function showHome() {
  viewHome.classList.remove("hidden");
  viewDetail.classList.add("hidden");
}

function showDetail() {
  renderDetail();
  viewHome.classList.add("hidden");
  viewDetail.classList.remove("hidden");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function getFilteredVisits() {
  return filterVisits(loadVisits(), currentFilters());
}

function renderHome() {
  const visits = getFilteredVisits();
  const summary = summarizeVisits(visits);

  kpiVisitas.textContent = summary.visits;
  kpiVentas.textContent = `$ ${formatCurrency(summary.sales)}`;
  kpiEfectividad.textContent = `${summary.effectiveness}%`;
  kpiPendiente.textContent = `$ ${formatCurrency(summary.pending)}`;

  if (!visits.length) {
    visitsList.innerHTML = '<p class="empty">No hay visitas con estos filtros.</p>';
    return;
  }

  visitsList.innerHTML = visits
    .slice()
    .sort((a, b) => `${b.fecha}${b.hora}`.localeCompare(`${a.fecha}${a.hora}`))
    .map((visit) => renderVisitItem(visit))
    .join("");
}

function renderDetail() {
  const sellerName = vendedorActivo.value;
  const seller = SELLERS.find((item) => item.name === sellerName) || SELLERS[0];
  const filters = { ...currentFilters(), vendedor: seller.name };
  const visits = filterVisits(loadVisits(), filters)
    .slice()
    .sort((a, b) => `${a.fecha}${a.hora}`.localeCompare(`${b.fecha}${b.hora}`));
  const summary = summarizeVisits(visits);

  document.getElementById("detail-title").textContent = seller.name;
  document.getElementById("detail-sub").textContent =
    `Detalle de ruta y paradas según filtros activos.`;
  document.getElementById("detail-ruta-chip").textContent = seller.ruta;
  document.getElementById("detail-visitas").textContent = summary.visits;
  document.getElementById("detail-ventas").textContent = `$ ${formatCurrency(summary.sales)}`;
  document.getElementById("detail-efectividad").textContent = `${summary.effectiveness}%`;
  document.getElementById("detail-exitos").textContent = summary.successful;

  const detailList = document.getElementById("detail-visits");
  if (!visits.length) {
    detailList.innerHTML = '<p class="empty">Sin paradas para esta ruta con los filtros actuales.</p>';
    return;
  }

  detailList.innerHTML = visits.map((visit) => renderVisitItem(visit)).join("");
}

function renderAll() {
  renderHome();
  if (!viewDetail.classList.contains("hidden")) {
    renderDetail();
  }
}

initControls();

vendedorActivo.addEventListener("change", () => {
  syncRuta();
  renderAll();
});

[filterFecha, filterEstado, filterResultado].forEach((input) => {
  input.addEventListener("change", renderAll);
});

resetFiltersBtn.addEventListener("click", () => {
  filterFecha.value = todayISO();
  filterEstado.value = "";
  filterResultado.value = "";
  renderAll();
});

openDetailBtn.addEventListener("click", showDetail);
backHomeBtn.addEventListener("click", showHome);

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
  const seller = SELLERS.find((item) => item.name === vendedorActivo.value) || SELLERS[0];

  const newVisit = normalizeVisit({
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
    fecha: filterFecha.value || todayISO(),
    vendedor: seller.name,
    ruta: seller.ruta,
  });

  const visits = loadVisits();
  visits.push(newVisit);
  saveVisits(visits);
  form.reset();
  latInput.value = "";
  lngInput.value = "";
  fillSelect(estadoSelect, ESTADOS, "Estado");
  fillSelect(resultadoSelect, RESULTADOS, "Resultado");
  clearFotoPreview();
  setGpsStatus("Usa el GPS del teléfono para registrar dónde estás.");
  renderAll();
});

clearBtn.addEventListener("click", () => {
  clearVisits();
  renderAll();
});

seedBtn.addEventListener("click", () => {
  seedDemoVisits();
  renderAll();
});

renderAll();
