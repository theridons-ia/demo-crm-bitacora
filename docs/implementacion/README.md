# Bitácora de implementación

Aquí queda **referencia escrita** (y diagramas) de lo que se construyó en cada fase: *qué*, *por qué* y *cómo* (archivos, endpoints, UI).

## Convención (a partir de ahora)

Al cerrar cada **SF-x.y** (o al final de un bloque de trabajo):

1. Se actualiza o crea un archivo en esta carpeta.
2. Cada sección incluye:
   - **Objetivo**
   - **Qué se hizo** (lista concreta)
   - **Cómo** (archivos, APIs, flujo)
   - **Cómo probarlo**
   - **Diagrama** (Mermaid) cuando aporte claridad
3. En `docs/SUBFASES.md` se marca el estado y se enlaza aquí.

Nombre de archivos:

| Archivo | Contenido |
|---------|-----------|
| `FASE-0-CIMIENTOS.md` | Resumen Fase 0 (si se documenta retroactivo) |
| `FASE-1-VENDEDOR.md` | SF-1.1 … SF-1.10 (+ fixes relacionados) |
| `FASE-2-SUPERVISOR.md` | Layout `/sup` (SF-2.1) + siguientes |
| `FASE-3-ENDURECER.md` | Inventario/ingresos (SF-3.1) + siguientes |
| `FASE-4-UI-MOVIL.md` | Homogeneizar UI móvil (SF-4.0 … SF-4.8) |
| `FASE-5-RUTA-SEMANAL.md` | Ruta = 1 vendedor × 1 semana (brújula; después de Fase 4) |
| `FASE-6-OPERACION-CAMION.md` | Pedido, entrega, autoventa, camión, cierre diario (después de Fase 5) |
| `NOTAS-PRODUCTO.md` | Decisiones sueltas (marca EnRutas, pins cliente/vendedor, etc.) |

## Índice

- [Fase 1 — Vendedor](./FASE-1-VENDEDOR.md)
- [Fase 4 — Homogeneizar UI móvil](./FASE-4-UI-MOVIL.md)
- [Fase 5 — Ruta semanal](./FASE-5-RUTA-SEMANAL.md)
- [Fase 6 — Operación camión](./FASE-6-OPERACION-CAMION.md)
- [Notas de producto / pendientes UX](./NOTAS-PRODUCTO.md)
- Arranque local: [`../ARRANQUE_LOCAL.md`](../ARRANQUE_LOCAL.md)
- Checkpoints: [`../SUBFASES.md`](../SUBFASES.md)
