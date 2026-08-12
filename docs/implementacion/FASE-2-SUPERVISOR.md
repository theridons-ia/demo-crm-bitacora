# Fase 2 — Supervisor

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
