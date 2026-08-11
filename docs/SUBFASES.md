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
5. Pasamos a la siguiente SF.

No mezclar varias SF en un solo commit si se puede evitar.

---

## Fase 0 — Cimientos

| ID | Objetivo | Entregable | Estado |
|----|----------|------------|--------|
| **SF-0.0** | Brújula documentada | `docs/DECISIONES_Y_ROADMAP.md` + este archivo + README | hecho (este commit) |
| **SF-0.1** | App web vacía con design system | `web/` Vite+React+TS, tokens CSS, pantalla placeholder | hecho (este commit) |
| **SF-0.2** | Web habla con API | Login → JWT → `/api/auth/me` + listar clientes | hecho |
| **SF-0.3** | Modelo dominio ampliado | `Sale.origin`, `VisitGpsPoint`, `VisitAlert` (+ migrate/create) | pendiente |
| **SF-0.4** | Seed + CORS para Vite | Seed rico; CORS `localhost:5173`; README dual | pendiente |

**Criterio “Fase 0 lista”:** puedes abrir `web/`, iniciar sesión contra `mvp/` y ver clientes.

---

## Fase 1 — Vendedor usable

| ID | Objetivo | Entregable | Estado |
|----|----------|------------|--------|
| **SF-1.1** | Shell UX vendedor | Bottom nav + tokens; layout móvil | pendiente |
| **SF-1.2** | Clientes CRUD mínimo | Lista/alta alineada al export | pendiente |
| **SF-1.3** | Visitas ciclo de vida | programada → en_curso → completada | pendiente |
| **SF-1.4** | GPS inicio/cierre | `getCurrentPosition` + guardar en visita | pendiente |
| **SF-1.5** | Trail ligero `en_curso` | `watchPosition` + `VisitGpsPoint` | pendiente |
| **SF-1.6** | Skip GPS + foto + alerta lejos | Flujos §3 del roadmap | pendiente |
| **SF-1.7** | Orden desde visita | Venta ligada a visita (USD/VES) | pendiente |
| **SF-1.8** | Orden sin visita | origen mostrador / online | pendiente |
| **SF-1.9** | Offline cola | IndexedDB + sync visita+venta; cache clientes/productos | pendiente |
| **SF-1.10** | Mapa evidencia | Leaflet: puntos de una visita | pendiente |

**Criterio “Fase 1 lista”:** un vendedor hace el día de campo offline-ish con evidencia GPS.

---

## Fase 2 — Supervisor

| ID | Objetivo | Entregable | Estado |
|----|----------|------------|--------|
| **SF-2.1** | Layout supervisor | Sidebar tablet/desktop | pendiente |
| **SF-2.2** | Ruta del día | Asignar / desasignar visitas planificadas | pendiente |
| **SF-2.3** | Alertas GPS/foto | Inbox de alertas | pendiente |
| **SF-2.4** | Visibilidad catálogo | Qué productos ve cada vendedor | pendiente |
| **SF-2.5** | Mapa equipo | Visitas del día en mapa | pendiente |

---

## Fase 3 — Endurecer (post-piloto)

| ID | Objetivo | Notas |
|----|----------|--------|
| SF-3.x | Alembic formal, crédito, compras, FX diario, import Excel | Ver roadmap |

---

## SF actual

**Listo para commit / tu push:** **SF-0.2** (login JWT + listado de clientes).

**Siguiente:** **SF-0.3** — modelo dominio ampliado (`Sale.origin`, `VisitGpsPoint`, `VisitAlert`).

### Cómo probar SF-0.2

1. Terminal API: `cd mvp && uvicorn app.main:app --host 0.0.0.0 --port 8090`
2. Terminal web: `cd web && npm run dev` → http://localhost:5173
3. Login: `marina@bitacora.local` / `demo1234`
4. Debes ver clientes del seed.
