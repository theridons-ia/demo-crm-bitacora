# Fase 2 — Supervisor

## SF-2.6 — Refresh visual (móvil + desktop)

### Objetivo
Acercar la UI al mock de diseño (crema / verde campo / coral), **sin Fraunces**: tipografía **DM Sans** en todo. Mantener datos reales de la API.

### Qué se hizo
- Tokens actualizados (`tokens.css`) + fuente Google DM Sans.
- Login, Inicio vendedor (hero + siguiente acción + KPIs + cartera + próximas).
- Hoy supervisor (KPIs reales, pulso, preview alertas).
- Inventario (KPIs, búsqueda, filtros disponible/bajo/agotado, barras).
- Layouts responsive: móvil apilado; ≥768px hero/grid en 2 columnas.

### Tipografía (decisión)
- **No** usar Fraunces/serif en titulares (se percibe anticuada).
- **DM Sans** para UI y títulos (`--font-display` = sans).

### Archivos
| Pieza | Ruta |
|-------|------|
| Tokens | `web/src/styles/tokens.css`, `base.css` (bloque SF-2.6) |
| Fonts | `web/index.html` |
| Inicio | `web/src/pages/HomePage.tsx` |
| Supervisor | `web/src/pages/SupervisorHomePage.tsx` |
| Inventario | `web/src/pages/InventoryPage.tsx` |
| Login | `web/src/pages/LoginPage.tsx` |

### Siguiente
Fase 3 o deploy Contabo.

---

## SF-2.5 — Mapa del equipo

### Objetivo
Ver en un mapa las visitas del día (programadas o visitadas esa fecha), con PDV y estado del vendedor.

### Qué se hizo
- `GET /api/visits?day=YYYY-MM-DD` (programada ese día **o** `visited_at` ese día).
- UI `/sup/mapa` con Leaflet, filtro fecha/vendedor, leyenda.
- Seed: pins demo en clientes principales sin coordenadas.

### Cómo verificar
1. Supervisor → **Mapa del equipo** → fecha de hoy.
2. Pins fucsia (PDV) + pastillas con iniciales (estado).
3. Filtrar por Marina/Carlos; asignar ruta y refrescar.

### Cierre Fase 2
SF-2.1…2.5 listos. Siguiente: Fase 3 o deploy Contabo / `enrutas.cc`.

---

## SF-2.4 — Visibilidad catálogo

### Objetivo
Definir qué productos ve (y puede vender) cada vendedor. Stock sigue siendo global.

### Qué se hizo
- Tabla `seller_product_visibility` (allowlist).
- Sin filas = catálogo completo; con filas = solo esos productos.
- `GET/PUT /api/sellers/{id}/catalog-visibility`.
- `GET /api/products` filtra para vendedor.
- UI `/sup/catalogo`.
- Seed: Carlos restringido a COLA1, AGUA600, MALTALATA; Marina sin restricción.

### Cómo verificar
1. Supervisor → Catálogo → Carlos: 3 productos; Guardar.
2. Login `carlos@bitacora.local` → Inventario: solo esos 3.
3. Marina → Inventario: todos.
4. «Permitir todos» en Carlos restaura catálogo completo.

### Siguiente
**SF-2.5** — Mapa del equipo.

---

## SF-2.3 — Inbox de alertas

### Objetivo
Supervisor ve alertas de evidencia (GPS omitido, lejos del PDV, solo foto, precisión baja) y puede marcarlas como vistas.

### Qué se hizo
- `GET /api/alerts?unacked_only=` con vendedor/cliente en la respuesta.
- `POST /api/alerts/{id}/ack` (supervisor/admin).
- UI `/sup/alertas` con filtro Pendientes / Todas.
- Seed demo de 3 alertas si la tabla está vacía.

### Cómo verificar
1. Login supervisor → **Alertas**.
2. Debe haber pendientes (seed) o créalas cerrando una visita con GPS omitido + foto.
3. **Marcar vista** → desaparece de Pendientes; sigue en Todas.

### Siguiente
**SF-2.4** — Visibilidad de catálogo por vendedor.

---

## SF-2.2 — Ruta del día

### Objetivo
Supervisor asigna visitas **programadas** a un vendedor/fecha y puede **desasignar** solo mientras sigan programadas (no borra historial `en_curso` / `completada`).

### Qué se hizo
- `GET /api/users/sellers` — lista vendedores.
- `POST /api/visits/assign` — crea visita `programada`.
- `DELETE /api/visits/{id}` — solo si `status=programada`.
- Filtros en listado: `scheduled_date`, `seller_id`, `status`.
- UI `/sup/ruta` con fecha, vendedor, asignar cliente, quitar de la ruta.
- Seed: segundo vendedor `carlos@bitacora.local` / `demo1234`.

### Cómo verificar
1. Login supervisor → **Ruta del día**.
2. Elige fecha de hoy + Marina (o Carlos).
3. Asigna 2 clientes → aparecen en planificadas.
4. Login Marina → Visitas: debe ver las programadas y poder **Iniciar**.
5. Como supervisor, **Quitar** una programada; si ya está en curso, el API rechaza el delete.

### Archivos
| Pieza | Ruta |
|-------|------|
| API users | `mvp/app/routers/users.py` |
| API visits | `mvp/app/routers/visits.py` |
| UI | `web/src/pages/RouteDayPage.tsx` |

### Siguiente
**SF-2.3** — Inbox de alertas GPS/foto.

---

## SF-2.1 — Layout supervisor

### Objetivo
Shell distinto al vendedor: **sin bottom nav**; sidebar en tablet/desktop (en móvil estrecho, nav horizontal arriba).

### Qué se hizo
- Rutas bajo `/sup/*` para `supervisor` y `admin`.
- Vendedor sigue en `/app/*` con `SellerShell`.
- Login redirige según rol (`marina` → app, `supervisor` → `/sup/hoy`).
- Pantalla **Hoy** con enlaces a módulos SF-2.2…2.5 (placeholders).

### Cómo verificar
1. Cerrar sesión.
2. Entrar con `supervisor@bitacora.local` / `demo1234`.
3. Debe abrir `/sup/hoy` con menú lateral (o chips arriba en móvil).
4. No debe aparecer la barra inferior de 5 pestañas.
5. Con `marina@…` sigue el flujo vendedor en `/app`.

### Archivos
| Pieza | Ruta |
|-------|------|
| Shell | `web/src/layout/SupervisorShell.tsx` |
| Nav | `web/src/layout/supervisorNav.ts` |
| Home | `web/src/pages/SupervisorHomePage.tsx` |
| Roles | `RequireRole`, `RoleHomeRedirect` |
| Rutas | `web/src/App.tsx` |
| Estilos | `web/src/styles/base.css` (bloque supervisor) |

### Siguiente
**SF-2.2** — Ruta del día (asignar / desasignar visitas planificadas).
