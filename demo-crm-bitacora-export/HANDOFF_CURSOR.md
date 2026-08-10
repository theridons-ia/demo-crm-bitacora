# Handoff — Bitácora Campo (demo web)

## Objetivo
Demo comercial web que reproduce la UX de Bitácora Campo para validación con clientes, con modelo Visita / Cliente / Orden de venta.

## Estado actual
Frontend estático mobile-first:

- **Clientes** (`@bitacora-campo/clients`): RIF, nombre, dirección, estado. Seed de 6 + alta desde formularios.
- **Visitas** (`@bitacora-campo/visits`): siempre con `clientId`. Estados Programada · En curso · Completada. `startAt` / `endAt` automáticos. Motivos (rutina, productos nuevos, negociar, cobranza, seguimiento, otro). Outcome al cerrar: con_venta / sin_venta.
- **Órdenes** (`@bitacora-campo/orders`): cliente obligatorio, visita opcional. Estados Borrador · Confirmada · Parcial. Líneas desde inventario (precio lista / mayor).
- **Inventario**: 8 productos (código, lista, mayor, caducidad) en tab Inventario.
- Sheet de visita en curso: cerrar o crear orden.
- Supervisor: KPIs + programar visita + asignar orden a vendedores.
- Manifest PWA básico (`manifest.webmanifest` + `icon.svg`).

## Cómo ejecutar
```bash
python3 -m http.server 8090
```

## Próximos pasos sugeridos
1. Service worker para offline real.
2. Conectar backend real tras validación comercial.
3. Autenticación por rol vendedor/supervisor.
4. Descuento / control de stock real.
