# Notas de producto / UX (referencia)

Decisiones y pendientes hablados en chat, para no perderlos.

---

## Marca y dominio

- Nombre de producto en exploración: **EnRutas** (dejar de usar solo “Bitácora” en cara al cliente).
- Dominio elegido para piloto: **`enrutas.cc`** (Namecheap; renovación ~$14/año aprox.).
- Hosting orientado a **Contabo VPS** (no shared hosting: este stack es FastAPI + Postgres).
- SSL del registrar: **no comprar**; usar Cloudflare Universal SSL o Let's Encrypt en el VPS.

---

## Cliente: dirección + pin

**Decisión:** suficiente con:

1. **Dirección escrita** (texto libre / referencias VE).
2. **Pin en mapa** (`latitude` / `longitude`).

**Hecho en SF-1.11:** UI de alta con mapa + GPS; pins distintos PDV vs vendedor en **Ver trail**.

Pendiente opcional: editar pin de un cliente ya creado.

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

## Próximos candidatos de implementación (doc + código)

1. ~~Formulario cliente: dirección + mapa pin + GPS actual.~~ **SF-1.11**
2. ~~En **Ver trail**: marcador PDV distinto del trail.~~ **SF-1.11**
3. Editar ubicación de cliente existente.
4. Fase 2 supervisor (layout, rutas del día, inbox alertas).
5. Deploy Contabo + `enrutas.cc` + HTTPS.

Al implementar cada punto: actualizar `FASE-*.md` o crear sección nueva aquí + entrada en `SUBFASES.md`.
