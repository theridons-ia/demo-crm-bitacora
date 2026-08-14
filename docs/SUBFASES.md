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
| **SF-2.6** | Refresh visual UI | Tokens + DM Sans; Inicio/Hoy/Inventario estilo mock (móvil+desktop) | hecho |
| **SF-2.6b** | Logo EnRutas + consistencia | Logo en shells; marca EnRutas; sin doble Salir desktop | hecho |
| **SF-2.6c** | UI export (cards/gráficos) | Ruta progress, métricas 2×2, CTA coral, ring + barras ranking/cobranza | hecho |
| **SF-2.7** | Shell unificado | Sidebar + header perfil (vendedor/supervisor); workspace con panel derecho | hecho |
| **SF-2.8** | Cartera + recorrido + desempeño | Clientes por vendedor; mapa ruta punteada; menú perfil; dashboard | hecho |


---

## Fase 3 — Endurecer (post-piloto)

| ID | Objetivo | Entregable | Estado |
|----|----------|------------|--------|
| **SF-3.1** | Inventario e ingresos | Compras/ajustes stock (supervisor) | hecho |
| **SF-3.2** | Crédito / cobranza | Estado de cuenta básico | hecho |
| **SF-3.3** | FX diario | Tasa USD/VES del día | hecho |
| **SF-3.4** | Import Excel | Maestros clientes/productos | pendiente |
| **SF-3.5** | Alembic formal | Migraciones DB (pre-prod) | pendiente |

Detalle: [`implementacion/FASE-3-ENDURECER.md`](implementacion/FASE-3-ENDURECER.md)

---

## Fase 4 — Homogeneizar UI móvil

Una SF por vez; revisar en el teléfono; documentar al cerrar. No toca APIs de visita/venta.

Detalle y videos: [`implementacion/FASE-4-UI-MOVIL.md`](implementacion/FASE-4-UI-MOVIL.md)

| ID | Objetivo | Entregable | Estado |
|----|----------|------------|--------|
| **SF-4.0** | Brújula UI | Este checkpoint + FASE-4 + reglas `ui-movil.mdc` | hecho |
| **SF-4.1** | Quemaduras | Galería (no solo cámara); Cancelar picker no cierra wizard; `Total $` simple | hecho |
| **SF-4.2** | Chrome + FAB | Fold usable; un solo `+`; FAB no tapa CTAs | hecho |
| **SF-4.3** | Una fila de visita | `VisitRow` en agenda / Visitas / mapa | hecho |
| **SF-4.4** | Inicio vendedor | Un progreso; agenda horaria; CTA mapa | hecho |
| **SF-4.5** | Mapa = agendado | Trazo y números = `scheduled_time`; seed del día limpio | hecho |
| **SF-4.6** | Wizard 1-2-3 | Nombres, footer, teclado, cuenta una vez | hecho |
| **SF-4.7** | Densidad catálogo | Inventario compacto; cliente una acción | hecho |
| **SF-4.8** | Supervisor móvil | Mismas piezas 4.3–4.5; Ruta/Visitas/Mapa = lentes | pendiente |

**Criterio “Fase 4 lista”:** vendedor y supervisor en ~400px usan la misma fila, el mapa coincide con la agenda, y cotizar no se pierde al cancelar una foto.

---

## Fase 5 — Ruta semanal (después de 4.x)

No mezclar con 4.3–4.8. Decisiones 4 / 17 / 18 / 21.

| ID | Objetivo | Entregable | Estado |
|----|----------|------------|--------|
| **SF-5.0** | Brújula ruta semanal | [`implementacion/FASE-5-RUTA-SEMANAL.md`](implementacion/FASE-5-RUTA-SEMANAL.md) + §2.1 del roadmap | hecho (docs) |

Siguientes SF se abren al cerrar Fase 4: modelo `Route`, UI supervisor (tarjeta por vendedor), UI vendedor (L–S + Sin día).

---

## SF actual

**Listo para commit / tu push:** **SF-4.7** inventario y clientes densos.

**Siguiente:** **SF-4.8** supervisor móvil. Luego Fase 5 (ruta semanal, solo docs hasta cerrar 4).

### Cómo verificar SF-4.7

1. Inventario (~400px): ≥6 productos a la vista. Cada fila = nombre · cantidad · estado. No SKU + barra + mínimo + $ apilados.
2. Clientes vendedor: tap = ficha. Sin badge Pin ni coordenadas.
3. Clientes supervisor: una fila; Asignar y Editar salen de la ficha, no de tres botones.

### Cómo verificar SF-4.4

1. Inicio: un hero (N de M + %). No 4 tarjetas que repiten lo mismo.
2. **Ver mapa** grande. Agenda con filas de visita (todas las abiertas de hoy).
3. Sin listado largo de clientes; una fila a Cartera. No aparece `0 de —` al cargar.

### Cómo verificar SF-4.6

1. Visita en curso → Registrar venta: nombres de producto enteros; un solo rail 1-2-3.
2. Footer: **Siguiente** / **Confirmar OV** visible; al abrir teclado en Referencia no tapa Confirmar.
3. Zelle: cuenta una vez; el hint no copia el mismo nombre.
4. Ventas → nueva OV sin visita: buscar cliente (no combo nativo kilométrico).

### Cómo verificar SF-4.5

1. Recorrido: Orden del día 1 El Río 08:00 → 2 Bodega 09:15 → … igual que los números del mapa.
2. El trazo no salta a Yaracuy si no está agendado hoy.
3. Recarga: sin 0% ni triángulos naranjas de Leaflet.

### Cómo verificar SF-4.3

1. Visitas → **Programadas**: filas compactas (LED · PDV · hora · chevron). Sin GPS ni 3 botones.
2. Tap = ficha. Título de la ficha es el estado, no el nombre dos veces.
3. 12:00 arriba de 14:00. Culminadas: más reciente primero. Vencidas: «Sin asistir» en Hoy y chips grises a la izquierda.
4. Inicio y Recorrido: misma fila.

### Cómo verificar SF-4.2

1. Teléfono ~360–412 px: Visitas / Inventario / Clientes — se ve la lista sin eyebrow + párrafo encima del título.
2. Un solo `+` (FAB). Al abrir un modal, el FAB desaparece.
3. Chips `Canceladas` / `Agotado` en una fila (scroll si no caben).
4. Relojes y “hoy” en hora Caracas (UTC−4), aunque el teléfono no esté en Venezuela.

### Cómo verificar SF-4.1

1. `marina@…` → Visitas → visita en curso → Registrar venta → paso 2.
2. Comprobante: botones **Galería** y **Cámara**. Cancelar deja la cotización.
3. Paso 1: un solo `$` en el total. Moneda Bs: solo Efectivo Bs, Pago móvil, Transferencia.

Excel (SF-3.4) y Alembic (SF-3.5) siguen pendientes; no mezclarlos con esta fase visual.

### Cómo verificar SF-2.8

1. Login Marina: menú **Clientes** (solo su cartera). Carlos no ve los de Marina.
2. Supervisor → **Clientes**: asignar PDV a vendedores y guardar.
3. Inicio vendedor: click **Tu ruta de hoy** o **Ver recorrido** → mapa con trazo punteado; al cerrar visitas el trazo se solidifica.
4. Perfil (arriba derecha): Perfil / Ajustes / Preferencias (+ Desempeño en vendedor).
5. Móvil: tab **Clientes** (ya no Resumen).

### Cómo verificar SF-2.7

1. Desktop ≥1100px: sidebar (logo + menú) + header; **panel derecho al ras** del saludo/header de cada vista.
2. Sin «Accesos rápidos» duplicando el menú; panel con contexto / placeholders rellenables.
3. Todas las vistas usan el mismo ancho de workspace (~1120–1200px).
4. FAB coral (+) en vendedor: Visita / Venta / Cliente.
5. Móvil: panel derecho debajo del main; bottom nav / chips.

### Cómo verificar SF-2.6c

1. Vendedor Inicio: saludo + avatar; tarjeta oscura «Tu ruta de hoy» con barra oro; grid 2×2 de métricas; CTA coral «Registrar actividad».
2. Supervisor Hoy: mismas métricas; anillo de cobertura; ranking con barras; alertas.
3. Cobranza: resumen Facturado / Cobrado / Por cobrar + top deudores con barras.

### Cómo verificar SF-2.6b

1. Login: logo EnRutas grande.
2. Supervisor: logo en sidebar + título EnRutas.
3. Vendedor desktop: topbar con logo; **sin** segunda barra Salir encima del hero.
4. Vendedor móvil: logo + Salir en cabecera; bottom nav intacta.

### Cómo verificar SF-3.3

1. Supervisor → Tasa FX → guardar.
2. Vendedor → Ventas en VES → ve Bs equivalentes; sin tasa el API rechaza.

### Cómo verificar SF-3.2

1. Vendedor → Ventas → «a crédito».
2. Supervisor → Cobranza → abono parcial/total.

### Cómo verificar SF-3.1

1. `supervisor@…` → Inventario → compra/ingreso → stock sube.
2. Ajuste −N sin pasar de 0.
3. Vendedor ve stock actualizado en su Inventario.

### Cómo verificar SF-2.6

1. Login Marina → Inicio: hero verde, CTA coral, KPIs, cartera con avatar, próximas visitas.
2. En móvil (&lt;768px): bottom nav; hero apilado; tipografía DM Sans (sin serif).
3. Supervisor → Hoy: KPIs + pulso + alertas + acciones.
4. Inventario: KPIs, filtros de estado, barras de stock.

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

