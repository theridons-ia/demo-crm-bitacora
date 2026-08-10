# Handoff — Bitácora Campo (demo web)

## Objetivo
Demo comercial web que reproduce la UX de la app móvil Bitácora Campo para validación con clientes.

## Estado actual
Frontend estático mobile-first con estética Bitácora Campo:

- CTA **Registrar actividad** con 3 flujos:
  - **Crear visita** (Ahora → En curso | Programar → Agenda)
  - **Cerrar visita** (elige visita abierta + resultado + productos + seguimiento)
  - **Registrar venta** (ligada a visita o venta suelta)
- Estados de visita: Programada · En curso · Completada
- Resultado comercial solo al completar: Sin venta / Parcial / Cerrada
- Inventario demo: Cola #1, Cola #2, Leche ABC
- Filtros: Hechas / Abiertas / Agenda / Con venta / Sin venta
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
