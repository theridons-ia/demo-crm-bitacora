# Bitácora Campo (demo web)

Demo web mobile-first alineada a la interfaz de **Bitácora Campo**, lista para evolucionar a PWA:

- navegación: Inicio · Visitas · Inventario · Resumen
- clientes con RIF, nombre y dirección (seed + alta)
- visitas ligadas a cliente (ahora / programar) con inicio/fin automáticos
- órdenes de venta independientes (cliente obligatorio, visita opcional)
- inventario / lista de precios (8 productos demo)
- panel de supervisor con asignación de visitas y órdenes
- persistencia local (`localStorage`) offline-first

## Ejecutar

```bash
python3 -m http.server 8090
```

Abrir:

- Vendedor: `http://localhost:8090/index.html`
- Supervisor: `http://localhost:8090/supervisor.html`

## Notas

- No requiere backend.
- Al vaciar/cargar demo se siembran 6 clientes, visitas y órdenes de ejemplo.
- Incluye `manifest.webmanifest` (PWA ligera; service worker pendiente).
- Iconos con **Lucide** (`unpkg.com/lucide`) en formularios y navegación.
