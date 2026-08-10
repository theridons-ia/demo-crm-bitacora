const API = "";
const TOKEN_KEY = "bitacora_token";
const OFFLINE_KEY = "bitacora_offline_queue";

const state = {
  token: localStorage.getItem(TOKEN_KEY) || "",
  user: null,
  clients: [],
  products: [],
  visits: [],
  gps: null,
  qty: {},
};

const loginView = document.getElementById("view-login");
const appView = document.getElementById("view-app");

function uuid() {
  return crypto.randomUUID ? crypto.randomUUID() : `local-${Date.now()}-${Math.random()}`;
}

function loadQueue() {
  try {
    return JSON.parse(localStorage.getItem(OFFLINE_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveQueue(queue) {
  localStorage.setItem(OFFLINE_KEY, JSON.stringify(queue));
  document.getElementById("pending-sync").textContent = `Cola offline: ${queue.length}`;
}

async function api(path, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (state.token) headers.Authorization = `Bearer ${state.token}`;
  if (options.body && !(options.body instanceof URLSearchParams)) {
    headers["Content-Type"] = "application/json";
  }
  const res = await fetch(`${API}${path}`, { ...options, headers });
  if (!res.ok) {
    let detail = "Error de API";
    try {
      const data = await res.json();
      detail = data.detail || JSON.stringify(data);
    } catch {}
    throw new Error(typeof detail === "string" ? detail : JSON.stringify(detail));
  }
  if (res.status === 204) return null;
  return res.json();
}

function setOnlineUI() {
  const online = navigator.onLine;
  document.getElementById("online-status").textContent = online ? "En línea" : "Sin conexión";
  saveQueue(loadQueue());
}

function showApp() {
  loginView.classList.add("hidden");
  appView.classList.remove("hidden");
}

function showLogin() {
  appView.classList.add("hidden");
  loginView.classList.remove("hidden");
}

function renderProducts() {
  const box = document.getElementById("products-box");
  const result = document.getElementById("result").value;
  const needsSale = result !== "sin_venta";
  box.classList.toggle("hidden", !needsSale);
  if (!needsSale) return;

  box.innerHTML = state.products.map((p) => `
    <div class="product-row" data-id="${p.id}">
      <div>
        <strong>${p.name}</strong>
        <p>$${p.price_usd} / ${p.unit} · stock ${p.stock}</p>
      </div>
      <div class="stepper">
        <button type="button" data-delta="-1">−</button>
        <span>${state.qty[p.id] || 0}</span>
        <button type="button" data-delta="1">+</button>
      </div>
    </div>
  `).join("");

  box.querySelectorAll(".product-row").forEach((row) => {
    const id = Number(row.dataset.id);
    row.querySelectorAll("button").forEach((btn) => {
      btn.addEventListener("click", () => {
        const delta = Number(btn.dataset.delta);
        state.qty[id] = Math.max(0, (state.qty[id] || 0) + delta);
        renderProducts();
      });
    });
  });
}

function renderVisits() {
  const list = document.getElementById("visits-list");
  if (!state.visits.length) {
    list.innerHTML = `<div class="card"><p>No hay visitas todavía.</p></div>`;
    return;
  }
  list.innerHTML = state.visits.map((v) => `
    <article class="item">
      <strong>${v.client?.name || "Cliente #" + v.client_id}</strong>
      <p>${v.status} · ${v.result || "sin resultado"}</p>
      <p>${v.description || "Sin descripción"}</p>
      <p>GPS: ${v.latitude && v.longitude ? `${v.latitude}, ${v.longitude}` : "no capturado"}${v.gps_offline ? " (offline)" : ""}</p>
      ${v.sale ? `<p>Venta: $${v.sale.total_amount} ${v.sale.currency}</p>` : ""}
    </article>
  `).join("");
}

function renderStock() {
  document.getElementById("stock-list").innerHTML = state.products.map((p) => `
    <article class="item">
      <strong>${p.name}</strong>
      <p>${p.sku} · $${p.price_usd} / ${p.unit}</p>
      <p>Stock: ${p.stock}</p>
    </article>
  `).join("");
  document.getElementById("metric-products").textContent = state.products.length;
}

async function refreshData() {
  const [clients, products, visits] = await Promise.all([
    api("/api/clients"),
    api("/api/products"),
    api("/api/visits"),
  ]);
  state.clients = clients;
  state.products = products;
  state.visits = visits;
  state.qty = Object.fromEntries(products.map((p) => [p.id, 0]));

  const select = document.getElementById("client-id");
  select.innerHTML = clients.map((c) => `<option value="${c.id}">${c.name}</option>`).join("");
  document.getElementById("metric-visits").textContent = visits.length;
  renderProducts();
  renderVisits();
  renderStock();
}

async function bootSession() {
  state.user = await api("/api/auth/me");
  document.getElementById("user-name").textContent = `Hola, ${state.user.full_name.split(" ")[0]}`;
  document.getElementById("user-role").textContent = state.user.role.toUpperCase();
  document.getElementById("user-route").textContent = state.user.route_name || "";
  showApp();
  setOnlineUI();
  await refreshData();
  if (navigator.onLine) await syncQueue();
}

async function syncQueue() {
  const queue = loadQueue();
  if (!queue.length || !navigator.onLine || !state.token) return;
  try {
    await api("/api/sync/offline-visits", {
      method: "POST",
      body: JSON.stringify({ visits: queue }),
    });
    saveQueue([]);
    await refreshData();
  } catch (err) {
    console.error(err);
    alert(`Sync pendiente: ${err.message}`);
  }
}

document.getElementById("login-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const error = document.getElementById("login-error");
  error.textContent = "";
  try {
    const body = new URLSearchParams();
    body.set("username", document.getElementById("email").value.trim());
    body.set("password", document.getElementById("password").value);
    const token = await api("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    state.token = token.access_token;
    localStorage.setItem(TOKEN_KEY, state.token);
    await bootSession();
  } catch (err) {
    error.textContent = err.message;
  }
});

document.getElementById("logout-btn").addEventListener("click", () => {
  state.token = "";
  localStorage.removeItem(TOKEN_KEY);
  showLogin();
});

document.querySelectorAll(".tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach((t) => t.classList.remove("active"));
    tab.classList.add("active");
    document.querySelectorAll(".tab-panel").forEach((panel) => panel.classList.add("hidden"));
    document.getElementById(`tab-${tab.dataset.tab}`).classList.remove("hidden");
  });
});

document.getElementById("result").addEventListener("change", renderProducts);

document.getElementById("gps-btn").addEventListener("click", () => {
  const status = document.getElementById("gps-status");
  if (!navigator.geolocation) {
    status.textContent = "Este dispositivo no soporta GPS";
    return;
  }
  status.textContent = "Capturando GPS…";
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      state.gps = {
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
        gps_accuracy_m: pos.coords.accuracy,
        gps_captured_at: new Date().toISOString(),
      };
      status.textContent = `GPS OK (±${Math.round(pos.coords.accuracy)} m)`;
    },
    () => {
      status.textContent = "No se pudo capturar GPS. Puedes guardar igual.";
    },
    { enableHighAccuracy: true, timeout: 15000 }
  );
});

document.getElementById("visit-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const result = document.getElementById("result").value;
  const items = Object.entries(state.qty)
    .filter(([, qty]) => qty > 0)
    .map(([product_id, quantity]) => ({ product_id: Number(product_id), quantity }));

  const payload = {
    local_uuid: uuid(),
    client_id: Number(document.getElementById("client-id").value),
    description: document.getElementById("description").value.trim(),
    result,
    latitude: state.gps?.latitude ?? null,
    longitude: state.gps?.longitude ?? null,
    gps_accuracy_m: state.gps?.gps_accuracy_m ?? null,
    gps_captured_at: state.gps?.gps_captured_at ?? new Date().toISOString(),
    visited_at: new Date().toISOString(),
    sale: result === "sin_venta" ? null : {
      items,
      currency: "USD",
      payment_method: "cash_usd",
      created_offline: !navigator.onLine,
      local_uuid: uuid(),
    },
  };

  if (!navigator.onLine) {
    const queue = loadQueue();
    queue.push({ ...payload, gps_offline: true });
    saveQueue(queue);
    alert("Sin conexión: visita guardada en cola offline.");
    return;
  }

  try {
    // flujo online: crear visita en curso y cerrarla
    const created = await api("/api/visits", {
      method: "POST",
      body: JSON.stringify({
        client_id: payload.client_id,
        status: "en_curso",
        description: payload.description,
        latitude: payload.latitude,
        longitude: payload.longitude,
        gps_accuracy_m: payload.gps_accuracy_m,
        local_uuid: payload.local_uuid,
      }),
    });
    await api(`/api/visits/${created.id}/close`, {
      method: "POST",
      body: JSON.stringify({
        result: payload.result,
        description: payload.description,
        latitude: payload.latitude,
        longitude: payload.longitude,
        gps_accuracy_m: payload.gps_accuracy_m,
        gps_captured_at: payload.gps_captured_at,
        gps_offline: false,
        sale: payload.sale,
      }),
    });
    state.gps = null;
    document.getElementById("description").value = "";
    document.getElementById("gps-status").textContent = "GPS pendiente";
    state.qty = Object.fromEntries(state.products.map((p) => [p.id, 0]));
    await refreshData();
    alert("Visita guardada");
  } catch (err) {
    alert(err.message);
  }
});

document.getElementById("sync-btn").addEventListener("click", syncQueue);
window.addEventListener("online", () => {
  setOnlineUI();
  syncQueue();
});
window.addEventListener("offline", setOnlineUI);

if (state.token) {
  bootSession().catch(() => {
    localStorage.removeItem(TOKEN_KEY);
    showLogin();
  });
}
setOnlineUI();
