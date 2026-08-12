# Fase 3 — Endurecer (post-piloto)

## SF-3.1 — Inventario e ingresos (supervisor)

### Objetivo
Que el **supervisor** registre **compras/ingresos** y **ajustes** de stock (el vendedor solo consulta).

### Qué se hizo
- Tabla `stock_movements` (`purchase` | `adjustment`).
- `GET/POST /api/stock-movements` (solo supervisor/admin).
- UI `/sup/inventario`: formulario + existencias + historial.
- Ítem **Inventario** en el menú supervisor.

### Cómo verificar
1. Login supervisor → **Inventario**.
2. Compra / ingreso de un producto → stock sube.
3. Ajuste negativo → stock baja (sin quedar bajo 0).
4. Marina → Inventario: ve el stock actualizado (según su catálogo).

### Siguiente
**SF-3.2** crédito/cobranza · **SF-3.3** FX diario · **SF-3.4** import Excel · Alembic formal cuando endurezcamos deploy.
