# Handoff — Bitácora Campo (demo web)

## Objetivo
Demo comercial web que reproduce la UX de la app móvil Bitácora Campo para validación con clientes.

## Estado actual
Frontend estático mobile-first con estética Bitácora Campo:

- Inicio / Visitas / Resumen
- CTA “Registrar actividad” con 3 flujos:
  - Programar visita (calendario/agenda)
  - Cerrar visita (GPS/foto + productos si hubo venta)
  - Registrar venta (inventario demo con cantidades)
- Inventario demo: Cola #1, Cola #2, Leche ABC
- Filtro Programadas con franja semanal
- Supervisor restyleado
- Persistencia local `@bitacora-campo/visits`

## Cómo ejecutar
```bash
python3 -m http.server 8080
```

## Próximos pasos sugeridos
1. Empaquetar como PWA (manifest + service worker).
2. Conectar backend real tras validación comercial.
3. Autenticación por rol vendedor/supervisor.
