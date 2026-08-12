# Fase 2 — Supervisor

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
