# Bitácora Campo — Decisiones, GPS y roadmap de arranque

Documento vivo. Actualizar cuando cambiemos una decisión de producto o técnica.

**Estado:** pre-piloto / aprendizaje + base vendible  
**Última actualización:** 2026-08-11  
**Audiencia piloto esperada:** ≤ 8 vendedores · ≤ 3 supervisores

---

## 1. Para qué existe el producto

App web/PWA para venta al mayor en campo (refrescos / camiones):

- El **vendedor** registra visitas, evidencia GPS, y puede generar ventas/órdenes.
- El **supervisor** asigna rutas del día, ve alertas (GPS lejano, sin GPS, foto de prueba) y no destruye historial al desasignar.
- Offline mínimo pero real: **cerrar visita + venta** sin red, con catálogo y clientes cacheados.

No es ERP completo ni app de tiendas (Play/App Store) en esta etapa.

---

## 2. Decisiones de producto (cerradas)

| # | Tema | Decisión |
|---|------|----------|
| 1 | Origen de la venta | Una **venta/orden** tiene `origen`: `visita` \| `mostrador` \| `online`. Puede existir **sin visita**. Si hay visita, queda ligada. |
| 2 | GPS | Toda visita debe poder asociar ubicación. Tracking continuo **ligero** mientras `en_curso` (ver §3). No hace falta 1 punto/segundo. |
| 3 | Sin GPS / lejos | Advertencias, no bloqueo duro. Se puede **saltar** con justificación. Offline: permitir **foto de evidencia**. Si lejos del cliente → guardar punto de cierre + **alerta** (vendedor y supervisor). |
| 4 | Rutas | Supervisor asigna **ruta del día** (visitas planificadas), puede desasignar/eliminar planificadas **sin borrar** historial de visitas ya ejecutadas. |
| 5 | Inventario | Stock **global** único. Visibilidad de productos **filtrable por vendedor** (qué ve / qué puede vender). |
| 6 | Moneda | Multimoneda desde el inicio práctico: **USD principal**, opción **VES (Bs.)**. (Tipos de cambio / liquidación se refinán en fases.) |
| 7–9 | Plataforma | **PWA** (no Play Store). Offline crítico: visita+venta+GPS(+foto). También cache de **clientes e inventario** para vender offline. |
| 10 | Momento | Empezar ya aunque la propuesta comercial no esté aprobada: base reutilizable y de aprendizaje. |
| 11 | Backend | **FastAPI + PostgreSQL** (aprendizaje consciente; Theridon ya conoce Django/Postgres). |
| 12 | Datos | Seed / datos de prueba hasta tener maestros reales. |
| 13 | Identificación VE | **Clientes y proveedores** llevan identificación venezolana: **RIF** y/o **CI** (campos explícitos; al menos uno requerido en validación de negocio). |

### Coherencia visual (no negociable en UI)

- Una **paleta / design tokens** compartida (colores, radios, tipografía).
- Misma estética de botones, inputs, sheets en todas las vistas.
- Iconos consistentes (Lucide u otro set único; evitar mezclar emojis sueltos con iconos).
- Mapas para ver evidencia GPS cuando haya coordenadas.
- Responsive: **móvil (vendedor)**, **tablet/desktop (supervisor)**; pocos usuarios, pero multi-dispositivo real.

Referencia visual: `demo-crm-bitacora-export/` (cream / verde oscuro / coral).

---

## 3. GPS a fondo (recomendación)

### 3.1 Qué NO hace falta

Seguimiento “minuto a minuto todo el día mientras la app está abierta” **no** es el requisito de negocio. El requisito es:

> Mientras la visita está **en curso**, poder demostrar dónde estuvo el vendedor, y al cierre tener un punto (o evidencia alternativa).

### 3.2 Coste de almacenamiento (tranquilizador)

Un punto GPS típico en DB: `lat`, `lng`, `accuracy_m`, `captured_at`, `visit_id` ≈ **40–80 bytes** útiles (+ índices).

Escenario pesimista piloto:

| Variable | Valor |
|----------|--------|
| Vendedores | 8 |
| Visitas/día/vendedor | 12 |
| Duración media en curso | 25 min |
| 1 muestra cada **60 s** | ~25 puntos/visita |
| Puntos/día totales | 8 × 12 × 25 ≈ **2 400** |
| Al mes (22 días) | ~53 000 puntos |
| Tamaño bruto aprox. | **unos pocos MB/mes** |

Construye **años** de historial antes de preocuparte por disco. Lo caro no es Postgres: es **batería, permisos del navegador y privacidad**.

### 3.3 Estrategia recomendada (equilibrada)

Tres capas de evidencia:

1. **Punto de inicio** al pasar visita a `en_curso` (obligatorio intentar).
2. **Muestras ligeras** solo en `en_curso`: cada **45–90 s**, o cuando el desplazamiento sea > **40–50 m** (`watchPosition` + filtro). Máximo razonable p.ej. 60 puntos/visita.
3. **Punto de cierre** al completar (siempre intentar).

Además:

- Flag `gps_skipped` + motivo si el usuario salta.
- `photo_evidence` si no hay GPS / offline extremo.
- Si el cliente tiene coordenadas y la distancia al cierre > umbral (ej. **150–300 m**) → crear **alerta** `gps_far_from_client` (visible vendedor + supervisor). No bloquear.

Opcional Fase 2: trail en mapa para el supervisor; geocerca más estricta configurable.

### 3.4 Cómo pide GPS el teléfono (PWA / navegador)

1. La app debe servirse por **HTTPS** (o `localhost` en desarrollo). Sin eso el navegador no da ubicación.
2. Usar la **Geolocation API**:
   - `navigator.geolocation.getCurrentPosition(...)` → un disparo (inicio/cierre).
   - `navigator.geolocation.watchPosition(...)` → seguimiento mientras `en_curso`; **clearWatch** al cerrar/cancelar.
3. El usuario ve el diálogo del sistema: “Permitir ubicación”. Hay que explicar **por qué** (evidencia de visita).
4. Opciones útiles: `{ enableHighAccuracy: true, maximumAge: 10_000, timeout: 15_000 }`.
5. **Límite importante de PWA:** en segundo plano (pantalla apagada / otra app), iOS y a menudo Android **recortan o paran** el GPS del navegador. Para este negocio suele bastar: tracking **con la visita abierta en primer plano**. Si más adelante exigen trail con pantalla bloqueada → Capacitor/nativo (fuera de alcance actual).

### 3.5 Qué guardar en modelo (borrador)

- `Visit`: `started_at`, `ended_at`, `start_lat/lng/accuracy`, `end_lat/lng/accuracy`, `gps_skipped`, `gps_skip_reason`, `photo_evidence_url`, etc.
- `VisitGpsPoint` (opcional pero recomendado): `visit_id`, `lat`, `lng`, `accuracy_m`, `captured_at`, `source` (`watch`|`start`|`end`).
- `VisitAlert`: tipo (`no_gps`, `gps_far`, `photo_only`, …), severidad, visto por supervisor.

---

## 4. Modelo de venta (alineación export ↔ API)

```
OrdenVenta / Sale
  origen: visita | mostrador | online
  client_id: obligatorio
  visit_id: opcional (si origen=visita, recomendado/requerido)
  currency: USD | VES
  lines[], payments..., status...
```

- Visita puede cerrarse **con o sin** venta.
- Mostrador/online no inventan visita falsa; simplemente `visit_id = null`.

El MVP actual solo vende al cerrar visita → hay que **evolucionar** el API hacia órdenes de primer nivel (como el export).

---

## 5. Recomendación de cómo arrancar el repo (§10)

**No** abras otra carpeta suelta “para después mudarnos”. Pierdes contexto y duplicas.

**Sí** trabaja en este mismo repo con roles claros:

```
demo-crm-bitacora/
  docs/                         # propuestas + este roadmap
  demo-crm-bitacora-export/     # CONGELADO: referencia UX / demo comercial
  mvp/                          # backend FastAPI actual → evoluciona (o se renombra luego a backend/)
  web/                          # NUEVO: React + Vite + PWA (aprender aquí)
```

| Pieza | Qué hacer |
|-------|-----------|
| `demo-crm-bitacora-export/` | No reescribir features ahí. Solo mirar / enseñar al cliente. |
| `mvp/` | Seguir siendo la API real; ir mejorando modelos (órdenes, GPS points, alertas, rutas). |
| `web/` | Frontend “de verdad”: tokens del export, mapas, PWA offline. |

Cuando haya piloto con cliente: mismos `web/` + `mvp/`, seed → import Excel. El export puede seguir existiendo como landing de demo.

### ¿Por qué React si nunca lo usaste?

Porque vas a necesitar: estados de visita, cola offline, mapas, roles, layouts tablet. Con HTML/JS plano se vuelve frágil rápido. Aprendemos **paso a paso** (componentes = pedazos de UI como partials de Django).

Alternativa más “cercana a lo que ya sabes”: seguir vanilla. **No la recomiendo** si quieres mapas + PWA + coherencia a largo plazo.

Backend: **FastAPI** está bien; conceptos parecidos a Django (rutas ≈ urls, schemas ≈ serializers, SQLAlchemy ≈ ORM). Postgres se queda.

---

## 6. Stack objetivo

| Capa | Tecnología |
|------|------------|
| API | FastAPI + SQLAlchemy 2 + PostgreSQL |
| Auth | JWT + roles `vendedor` / `supervisor` / `admin` |
| Migraciones | Alembic (añadir pronto; hoy `create_all` es demo) |
| Frontend | React 19 + Vite + TypeScript (aprendemos TS suave) |
| Estilos | CSS variables / design tokens (portar export) + estructura de componentes |
| Iconos | Lucide (mismo set que el export) |
| Mapas | Leaflet + OpenStreetMap (sin API key cara) o MapLibre |
| Offline | Service Worker (Vite PWA) + IndexedDB; sync a `/api/sync/...` |
| Hosting | VPS + HTTPS (Caddy/Nginx) |

Escala de 8+3 usuarios: un solo VPS pequeño sobra.

---

## 7. Design system (base)

Partir de tokens del export:

| Token | Valor orientativo |
|-------|-------------------|
| `--background` | `#F7F3ED` |
| `--foreground` / primary | `#18312F` |
| `--accent` | `#F16B5F` |
| `--card` | `#FFFDFC` |
| `--muted-foreground` | `#71807B` |
| Radios | 14 / 18 / 24px |
| Fuente | Definir una sola familia display + body (evitar mezclar 3 fuentes) |

Reglas:

- Botón primario / secundario / destructivo / ghost — **mismos** en vendedor y supervisor.
- Inputs y selects con la misma altura y borde.
- Iconos Lucide; emojis solo si aportan y con criterio (mejor icono).
- Vendedor: shell móvil (bottom nav). Supervisor: sidebar o top nav en ≥768px + mapa/listas.

Detalle de componentes se documentará en `web/` cuando exista (`DESIGN.md` o Story-light).

---

## 8. Metas por fases (técnicas)

### Fase 0 — Cimientos (ahora)

- [x] Decisiones de producto documentadas (este archivo)
- [ ] Estructura `web/` (Vite React) + tokens CSS
- [ ] Alembic + modelo: órdenes con `origen`, `VisitGpsPoint`, alertas, asignación de ruta
- [ ] Seed enriquecido (datos de prueba)
- [ ] README raíz actualizado (cómo correr API + web)

### Fase 1 — Piloto usable

- [ ] Login por rol
- [ ] Vendedor: clientes, visitas (programada → en_curso → completada), GPS inicio/muestras/cierre
- [ ] Venta desde visita + venta sin visita (mostrador/online)
- [ ] Offline cola visita+venta; cache clientes/productos
- [ ] Supervisor: ruta del día, asignar/desasignar, ver alertas GPS/foto
- [ ] Mapa simple de evidencia por visita
- [ ] USD / VES en orden (tipo de cambio simple configurable)

### Fase 2 — Endurecer

- [ ] Crédito / cobranza básica
- [ ] Compras a proveedores → stock
- [ ] Mapa de productividad del equipo
- [ ] Permisos finos de catálogo por vendedor (UI admin)
- [ ] Import Excel maestros

### Fase 3 — Extra

- [ ] Notificaciones / metas
- [ ] Offline más agresivo
- [ ] Capacitor solo si el GPS en background se vuelve requisito comercial

---

## 9. Aprendizaje (Theridon)

Orden sugerido, sin prisa:

1. Correr y leer el `mvp/` FastAPI (routers, models, schemas).
2. Montar `web/` con una pantalla login + listado clientes contra el API.
3. Portar una sola vista del export (Inicio vendedor) a React.
4. Visita en curso + `getCurrentPosition`.
5. `watchPosition` + tabla de puntos.
6. Mapa Leaflet con esos puntos.
7. Cola offline + sync.

Cada PR/chat puede ser **una** de esas piezas. Paciencia explícita: explicamos el “por qué” de React cuando toque.

---

## 10. Ejecución por sub-fases

El plan operativo (checkpoints de GitHub) vive en **[SUBFASES.md](./SUBFASES.md)**.

- Cada SF = un commit revisable.
- **Push / pull los ejecuta Theridon** (no el agente).
- SF actual: ver tabla al final de `SUBFASES.md`.
