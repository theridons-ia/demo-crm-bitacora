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

---

## SF-3.2 — Crédito / cobranza

### Objetivo
Estado de cuenta básico: ventas `is_credit` + abonos hasta saldar.

### Qué se hizo
- Tabla `sale_payments`.
- `GET /api/receivables`, `POST /api/receivables/{sale_id}/payments`.
- UI `/sup/cobranza` (supervisor).
- Checkbox «Venta a crédito» en Ventas (vendedor).
- Seed: una CxC demo si no hay créditos.

### Cómo verificar
1. Marina → Ventas → Nueva → marcar crédito → confirmar.
2. Supervisor → **Cobranza** → ver saldo → Registrar abono parcial/total.
3. Con saldo 0 desaparece de «Con saldo».

---

## SF-3.3 — FX diario

### Objetivo
Tasa **USD → VES** del día (Bs por 1 USD), cargada por supervisor; se congela en la venta si liquidan en Bs.

### Qué se hizo
- Tabla `fx_rates` + columna `sales.fx_rate_usd_ves`.
- `GET /api/fx/today`, `GET /api/fx`, `PUT /api/fx`.
- UI `/sup/fx`.
- Ventas en VES requieren tasa; muestran equivalente en Bs.
- Seed: tasa demo 36.50 si no hay filas.

### Cómo verificar
1. Supervisor → **Tasa FX** → guardar Bs/USD.
2. Marina → Ventas → moneda VES → ver equivalente.
3. Confirmar venta VES → queda `fx_rate_usd_ves` en la venta.
