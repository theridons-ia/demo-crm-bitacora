# Handoff — Bitácora Campo (demo web)

## Objetivo
Demo comercial web que reproduce la UX de la app móvil Bitácora Campo para validación con clientes.

## Estado actual
Frontend estático mobile-first con estética Bitácora Campo:

- `index.html` + `app.js`: app del vendedor
  - Inicio (saludo, ruta del día, métricas, CTA, actividad)
  - Visitas (búsqueda, chips, listado, vaciar demo)
  - Resumen (ventas acumuladas, barras, objetivo diario)
  - Pantalla Nueva visita (estado, resultado, GPS, foto)
- `supervisor.html` + `supervisor.js`: panel gerencial
- `shared.js`: modelo, storage `@bitacora-campo/visits`, seed
- `styles.css`: tokens visuales de la guía

## Cómo ejecutar
```bash
python3 -m http.server 8080
```

## Próximos pasos sugeridos
1. Empaquetar como PWA (manifest + service worker).
2. Conectar backend real tras validación comercial.
3. Autenticación por rol vendedor/supervisor.
