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

## SF-3.3 — Tasas (BCV / USDT)

### Objetivo
Tasa **USD BCV → VES** del día para liquidar ventas en Bs, más snapshot **USDT** y **EUR BCV**. Fuentes del pack SPTCA (`tasas_fuentes.py`): DolarApi → Dolitoday → ExchangeRate-API; USDT Binance P2P → Yadio.

### Qué se hizo
- Tabla `fx_rates` (`usd_to_ves`, `usdt_to_ves`, `eur_to_ves`, fuentes) + columna `sales.fx_rate_usd_ves`.
- `GET /api/fx/today`, `GET /api/fx`, `POST /api/fx/refresh`, `PUT /api/fx`.
- UI `/sup/fx`: tarjetas USD BCV · USDT · BS (alias BCV) · EUR + **Actualizar ahora**.
- Ventas en VES siguen usando **solo** `usd_to_ves` (BCV). Equivalencias de precio a varias tasas: pendiente.

### Cómo verificar
1. Supervisor → **Tasas** → **Actualizar ahora**.
2. Ver USD BCV, USDT y BS (mismo valor que BCV).
3. Marina → Ventas → moneda VES → usa el BCV guardado.
