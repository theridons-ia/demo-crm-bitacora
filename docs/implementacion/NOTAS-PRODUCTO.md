# Notas de producto / UX (referencia)

Decisiones y pendientes hablados en chat, para no perderlos.

---

## UI / tipografía (SF-2.6)

- Referencia visual: mock Replit (supervisor / seller / inventory) — crema, verde, coral.
- **Fraunces descartada** para titulares; usamos **DM Sans** en toda la app.
- Refresh aplicado en login, inicio vendedor, hoy supervisor e inventario (móvil + desktop).

- Nombre de producto en exploración: **EnRutas** (dejar de usar solo “Bitácora” en cara al cliente).
- Dominio elegido para piloto: **`enrutas.cc`** (Namecheap; renovación ~$14/año aprox.).
- Hosting orientado a **Contabo VPS** (no shared hosting: este stack es FastAPI + Postgres).
- SSL del registrar: **no comprar**; usar Cloudflare Universal SSL o Let's Encrypt en el VPS.

---

## Cliente: dirección + pin

**Decisión:** suficiente con:

1. **Dirección escrita** (texto libre / referencias VE).
2. **Pin en mapa** (`latitude` / `longitude`).

**Hecho en SF-1.11 / SF-1.12:** UI de alta y **edición** con mapa + GPS; pins distintos PDV vs vendedor; ficha con mapa.

### Búsqueda por calle (OSM / Nominatim) en Venezuela

- OSM **sí puede** buscar, pero cobertura **irregular**.
- En VE las direcciones suelen ser por **referencia**, no número de casa.
- **No** depender de geocoding automático como Google.
- El pin manual + texto es el camino robusto.

---

## Pins distintos cliente vs vendedor

**Decisión:** sí · **hecho en SF-1.11.**

| Entidad | Estilo |
|---------|--------|
| Cliente / PDV | Cuadrado verde `#2f6b4f` |
| Inicio vendedor | Círculo verde oscuro `#18312f` |
| Trail | Círculo coral `#f16b5f` |
| Cierre | Círculo rojo `#c84b46` |

---

## Mapas: OSM vs Google

### Situación
- Hoy: **Leaflet + OpenStreetMap** (gratis; datos VE a veces desactualizados).
- Google Maps: mejor basemap en VE, pero pay‑as‑you‑go + ToS (no cachear tiles; usar su JS API, no “pegar” tiles de Google en Leaflet).

### Recomendación de producto
1. **Piloto:** seguir con OSM + pins/direcciones propios.
2. **Probar Google:** cuenta Google Cloud + facturación + API key + tope de presupuesto ($10–20).
3. **En código:** flag `VITE_MAP_PROVIDER=osm|google` y adaptadores (no mezclar tiles de Google dentro de Leaflet: incumple ToS).
4. No hace falta suscripción Starter ($100+); cupo gratis pay‑as‑you‑go suele bastar para ≤8 vendedores.

### Pasos para probar Google (cuando quieras)
1. [Google Cloud Console](https://console.cloud.google.com/) → proyecto nuevo.
2. Activar **Maps JavaScript API** (y Geocoding solo si buscas direcciones).
3. Credenciales → API key → restringir por HTTP referrer (`localhost:5173`, `enrutas.cc`, etc.).
4. Presupuesto + alerta (ej. $10).
5. Variable en `web/.env.local`: `VITE_GOOGLE_MAPS_API_KEY=…` y `VITE_MAP_PROVIDER=google`.
6. Implementar adaptador Google en picker PDV + Ver trail.

### Pendiente de código
- Abstracción `MapProvider` (OSM / Google) detrás de `ClientLocationPicker` y `VisitMapSheet`.

1. ~~Formulario cliente: dirección + mapa pin + GPS actual.~~ **SF-1.11**
2. ~~En **Ver trail**: marcador PDV distinto del trail.~~ **SF-1.11**
3. ~~Editar ubicación de cliente existente.~~ **SF-1.12**
4. Fase 2 supervisor (layout, rutas del día, inbox alertas).
5. Deploy Contabo + `enrutas.cc` + HTTPS.

Al implementar cada punto: actualizar `FASE-*.md` o crear sección nueva aquí + entrada en `SUBFASES.md`.
