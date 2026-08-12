# Sub-fases Bitácora Campo — checkpoints para GitHub

Cada **SF-x.y** es un checkpoint revisable: se hace commit local y **tú** haces `git push` / `git pull`.

Convención de commit:

```text
SF-0.1: descripción corta en español o inglés
```

Rama de trabajo sugerida: la actual (`cursor/mvp-fastapi-postgres-1c14`) o una nueva `feat/web-pwa` cuando prefieras.

---

## Cómo trabajamos

1. Implementamos una sub-fase.
2. Revisas en local (API + web).
3. Commit local (puedo prepararlo yo si lo pides).
4. **Tú** ejecutas `git push`.
5. Documentamos en [`docs/implementacion/`](implementacion/README.md) qué se hizo y cómo.
6. Pasamos a la siguiente SF.

No mezclar varias SF en un solo commit si se puede evitar.

**Bitácora de implementación (detalle por fase):** [implementacion/README.md](implementacion/README.md)

---

## Fase 0 — Cimientos

| ID | Objetivo | Entregable | Estado |
|----|----------|------------|--------|
| **SF-0.0** | Brújula documentada | `docs/DECISIONES_Y_ROADMAP.md` + este archivo + README | hecho (este commit) |
| **SF-0.1** | App web vacía con design system | `web/` Vite+React+TS, tokens CSS, pantalla placeholder | hecho (este commit) |
| **SF-0.2** | Web habla con API | Login → JWT → `/api/auth/me` + listar clientes | hecho |
| **SF-0.3** | Modelo dominio ampliado | `Sale.origin`, `VisitGpsPoint`, `VisitAlert` (+ migrate/create) | hecho |
| **SF-0.4** | Seed + CORS + IDs VE | Seed rico; RIF/CI en clientes y proveedores; CORS Vite; README dual | hecho |

**Criterio “Fase 0 lista”:** puedes abrir `web/`, iniciar sesión contra `mvp/` y ver clientes.

---

## Fase 1 — Vendedor usable

| ID | Objetivo | Entregable | Estado |
|----|----------|------------|--------|
| **SF-1.1** | Shell UX vendedor | Bottom nav + tokens; layout móvil | hecho |
| **SF-1.1b** | Nav desktop vendedor | ≥768px: top bar (ocultar bottom nav); móvil sigue abajo | hecho |
| **SF-1.2** | Clientes CRUD mínimo | Lista/alta alineada al export | hecho |
| **SF-1.3** | Visitas ciclo de vida | programada → en_curso → completada | hecho |
| **SF-1.4** | GPS inicio/cierre | `getCurrentPosition` + guardar en visita | hecho |
| **SF-1.5** | Trail ligero `en_curso` | `watchPosition` + `VisitGpsPoint` | hecho |
| **SF-1.6** | Skip GPS + foto + alerta lejos | Flujos §3 del roadmap | hecho |
| **SF-1.7** | Orden desde visita | Venta ligada a visita (USD/VES) | hecho |
| **SF-1.8** | Orden sin visita | origen mostrador / online | hecho |
| **SF-1.9** | Offline cola | IndexedDB + sync visita+venta; cache clientes/productos | hecho |
| **SF-1.10** | Mapa evidencia | Leaflet: puntos de una visita | hecho |
| **SF-1.11** | Pin PDV en cliente + mapa | Dirección + pin; PDV verde vs trail vendedor | hecho |
| **SF-1.12** | Editar cliente + pin | PATCH cliente; ficha → editar datos/mapa | hecho |

**Criterio “Fase 1 lista”:** un vendedor hace el día de campo offline-ish con evidencia GPS.

---

## Fase 2 — Supervisor

| ID | Objetivo | Entregable | Estado |
|----|----------|------------|--------|
| **SF-2.1** | Layout supervisor | Sidebar o top nav tablet/desktop (sin bottom nav) | hecho |
| **SF-2.2** | Ruta del día | Asignar / desasignar visitas planificadas | hecho |
| **SF-2.3** | Alertas GPS/foto | Inbox de alertas | hecho |
| **SF-2.4** | Visibilidad catálogo | Qué productos ve cada vendedor | hecho |
| **SF-2.5** | Mapa equipo | Visitas del día en mapa | hecho |

---

## Fase 3 — Endurecer (post-piloto)

| ID | Objetivo | Notas |
|----|----------|--------|
| SF-3.x | Alembic formal, crédito, compras, FX diario, import Excel | Ver roadmap |

---

## SF actual

**Listo para commit / tu push:** **SF-2.5** (mapa del equipo) — **Fase 2 completa**.

**Siguiente:** Fase 3 (endurecer) o Contabo / `enrutas.cc` cuando digas.

### Cómo verificar SF-2.5

1. `supervisor@…` → Mapa del equipo → hoy.
2. Ver PDVs + estados; filtrar vendedor.

### Cómo verificar SF-2.4

1. Supervisor → Catálogo → Carlos con subconjunto / Marina completa.
2. Login Carlos → Inventario filtrado; Marina ve todo.

### Cómo verificar SF-2.3

1. `supervisor@…` → Alertas → pendientes (seed o cierres reales).
2. Marcar vista; filtrar Todas para ver historial.

### Cómo verificar SF-2.2

1. `supervisor@…` → Ruta del día → fecha + vendedor → asignar clientes.
2. `marina@…` → Visitas → aparecen programadas → Iniciar.
3. Desasignar solo funciona mientras esté programada.

### Cómo verificar SF-2.1

1. Login `supervisor@bitacora.local` / `demo1234` → `/sup/hoy`.
2. Sidebar (desktop) o nav horizontal (móvil); **sin** bottom nav de vendedor.
3. Login `marina@…` → sigue `/app/inicio` con bottom/top nav de vendedor.

### Cómo verificar SF-1.12

1. Inicio → toca un cliente «Sin pin» → **Editar datos y pin**.
2. Fija ubicación en el mapa / GPS → Guardar cambios.
3. La ficha debe mostrar el mapa y el badge pasa a **Con pin**.

### Cómo verificar SF-1.11

1. Inicio → Nuevo cliente → dirección escrita + toca el mapa (pin verde) o «Usar mi GPS».
2. Guarda; en la lista debe verse el pin.
3. Visita a ese cliente → **Ver trail**: PDV verde + puntos vendedor (inicio/trail/cierre) y leyenda.

### Cómo verificar SF-1.10

1. Abre una visita con GPS (en curso o completada) → **Ver trail**.
2. Debe mostrar marcadores (inicio / trail / cierre) y polilínea sobre OSM.
3. Si no hay puntos en API pero la visita tiene lat/lng, muestra ese punto de respaldo.

### Cómo verificar SF-1.9

1. Entra online una vez (cachea clientes/productos).
2. DevTools → Network → Offline.
3. Visitas → Nueva (ahora) → queda local; Cerrar (± venta/foto) → entra a la cola.
4. Ventas → Nueva offline → cola de venta mostrador/online.
5. Vuelve online (o toca **Sincronizar**): la cola se vacía vía `/api/sync/offline-visits` y closes/sales.

### Cómo verificar SF-1.8

1. Reinicia uvicorn si hace falta (router `/api/sales`).
2. En web → **Ventas** → **Nueva** → cliente + origen mostrador/online + productos → Confirmar.
3. La venta aparece en la lista (sin visita) y el stock baja en Inventario.
4. Las ventas al cerrar visita también listan aquí con origen `visita`.

