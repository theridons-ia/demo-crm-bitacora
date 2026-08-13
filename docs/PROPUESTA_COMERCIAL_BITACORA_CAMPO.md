# Propuesta comercial  
## EnRutas — CRM de visitas y ventas de campo (Bitácora Campo)

**Preparada para:** [Nombre del cliente]  
**Preparada por:** Theridon / [Tu razón social]  
**Fecha:** [Completar]  
**Validez de la oferta:** 15 días  
**Moneda de cotización:** USD

---

## 1. Entendimiento del negocio

Hoy la operación comercial se apoya principalmente en **Excel y WhatsApp**, sin un sistema de campo.  
El dolor prioritario es **dar fe de que el vendedor visitó realmente al PDV**, con evidencia de ubicación, registrar visitas/ventas/inventario de forma ordenada, y **calcular y consultar comisiones** del equipo de forma confiable.

La solución es **EnRutas**: aplicación web (PWA) usable en celular, tablet y laptop, con panel para vendedor y supervisor/administración.

---

## 2. Objetivo del proyecto

Poner en **producción un piloto usable** que permita:

1. Registrar visitas con **prueba GPS** (y foto si se omite GPS).
2. Asociar ventas a visitas o crear órdenes de mostrador/online.
3. Trabajar en campo **con señal inestable** (cola offline de visita + venta).
4. Que el supervisor asigne ruta del día, vea el mapa del equipo, alertas y cobranza básica.
5. Centralizar clientes, productos, stock y usuarios en PostgreSQL (dejar Excel como fuente principal).
6. Gestionar **comisiones básicas** por vendedor a partir de las ventas registradas.

> Esta oferta cotiza: (a) **publicar/endurecer** la base ya demostrable de EnRutas, (b) **desarrollar el módulo de comisiones básicas** (aún no existe en el demo), (c) puesta en marcha + capacitación.

---

## 3. Alcance de la entrega mínima (piloto go-live)

### Incluye
- App web EnRutas en **producción** (HTTPS)
- Roles: **vendedor**, **supervisor**, **admin**
- Funcionalidad piloto (ya existente, lista para uso real):
  - Clientes (RIF/CI, pin PDV)
  - Visitas (programada → en curso → cerrada) + GPS / trail / alertas
  - Ruta del día (vendedor: recorrido sólido/punteado; supervisor: asignar/quitar)
  - Ventas con/sin visita + descuento de stock
  - Inventario (consulta vendedor; ingresos/ajustes supervisor)
  - Cobranza básica (crédito + abonos)
  - Tasa FX USD→VES del día
  - Catálogo / visibilidad por vendedor
  - Offline mínimo (visita + venta)
- **Comisiones básicas (nuevo módulo en el piloto):**
  - Regla simple configurable: **% sobre venta** (global y/o por vendedor)
  - Cálculo automático al registrar ventas (visita / mostrador / online)
  - Consulta supervisor: comisiones del período por vendedor
  - Consulta vendedor: “mis comisiones” del período
  - Exportación simple (CSV/Excel) del período
  - *No incluye en este piloto:* esquemas escalonados complejos, comisión por familia/SKU, liquidación nómina, bonos por meta, split multi-vendedor, ni conciliación contable*
- **Puesta en marcha:** VPS + dominio (si aplica) + SSL + backups básicos
- **Hosting del primer mes incluido** en el arranque
- Carga inicial de maestros: **1** importación/carga asistida (clientes/productos)
- Carga/definición inicial de **reglas de comisión** del piloto (con el cliente)
- Hasta **15–20 usuarios** piloto
- Capacitación remota: **1 sesión hasta 2 h** + manual corto
- Estabilización: **hasta 2 semanas** post go-live (bugs críticos del alcance acordado)
- Branding ligero: logo/colores del cliente si aportan assets (sobre UI actual)

### No incluye
- ERP / contabilidad fiscal / SENIAT
- App nativa App Store / Play Store (sí PWA instalable)
- Offline total / GPS en segundo plano con pantalla bloqueada
- Optimización de rutas con IA
- Multibodega, facturación electrónica
- Integraciones bancarias, Zelle, USDT on-chain
- Comisiones avanzadas (escalones, por producto/familia, bonos, liquidación de nómina)
- Redesign completo de UI
- Capacitación presencial multi-sede
- Migraciones históricas masivas de Excel (más de 1 carga)
- Nuevos módulos o cambios de alcance (van por addendum)

---

## 4. Fases sugeridas

### Fase A — Piloto go-live (esta propuesta)
**Duración:** 3 a 5 semanas  
Publicación, **módulo de comisiones básicas**, datos, capacitación, estabilización corta.

### Fase B — Operación ampliada (opcional, cotiza aparte)
Reportes gerenciales, metas/notificaciones, imports recurrentes, reglas de territorio, mejoras de cobranza, **comisiones avanzadas** (escalones, por producto, bonos).

### Fase C — Escala (opcional)
PWA endurecida, Capacitor solo si exigen GPS en background, integraciones.

---

## 5. Entregables

| Entregable | Descripción |
|---|---|
| App en producción | EnRutas con HTTPS |
| Accesos | Vendedor / supervisor / admin |
| Datos iniciales | 1 carga asistida de maestros + reglas de comisión |
| Manual corto | PDF o doc de uso (incluye comisiones) |
| Hosting mes 1 | Incluido en el arranque |
| Acta de aceptación | Checklist piloto firmado |

---

## 6. Inversión (mercado Venezuela)

### Arranque — paquete piloto (recomendado)
| Concepto | Monto |
|---|---|
| Implementación + endurecimiento + go-live | Incluido |
| Módulo de **comisiones básicas** | Incluido |
| Hosting / VPS + SSL + backups (setup + **mes 1**) | Incluido |
| Capacitación (1 sesión remota) | Incluida |
| **Total arranque** | **USD 1.200 – 1.400** |

> Se sube el rango respecto a “solo publicar el demo” porque **comisiones es desarrollo nuevo**.  
> Precio de referencia cerrado típico: **USD 1.300**.  
> Si las reglas del cliente son solo “un % fijo por vendedor”, se puede cerrar en **USD 1.200**.  
> Si piden excepciones por producto/familia o escalones, pasa a Fase B o addendum.

### Mensual — desde el mes 2
| Concepto | Monto |
|---|---|
| Hosting (VPS + SSL + backups) | Incluido |
| Mantenimiento y resolución de problemas | Incluido |
| **Total mensual** | **USD 70** |

**Tope del plan mensual:** hasta **5 horas/mes** de soporte (bugs, dudas de uso, ajustes menores dentro del alcance).  
Excedentes, cambios de producto o nuevas funciones: **cotización aparte**.

### Forma de pago (arranque)
1. **50%** al inicio (anticipo / kickoff)  
2. **30%** al entregar staging listo para pruebas del cliente  
3. **20%** al publicar en producción + capacitación  

---

## 7. Supuestos

- Hasta 15–20 usuarios activos en el piloto.
- El cliente entrega a tiempo: vendedores, clientes, productos y un responsable de pruebas.
- Smartphones con GPS y Chrome/Safari actualizados.
- La evidencia GPS depende del permiso del dispositivo y la señal; existe flujo “sin GPS” + foto/alerta.
- El alcance cerrado de esta propuesta no se convierte en “ERP completo” sin addendum.

---

## 8. Beneficios esperados

- Prueba objetiva de visita (GPS + tiempo + mapa).
- Menos dependencia de Excel/WhatsApp como sistema.
- Visibilidad del supervisor (ruta, alertas, ventas, cobranza).
- Costo de entrada y operación mensual acotados al mercado VE.
- Base lista para crecer (Fase B/C) sin rehacer todo.

---

## 9. Riesgos y mitigación

| Riesgo | Mitigación |
|---|---|
| Señal móvil inestable | Cola offline visita + venta |
| Permisos GPS denegados | Skip GPS + foto + alertas a supervisor |
| Scope creep a ERP o comisiones complejas | Alcance cerrado (solo % básico); avanzado por addendum |
| Excel desordenado | 1 carga asistida; limpieza extra cotiza aparte |
| Soporte ilimitado por chat | Tope 5 h/mes en el plan de USD 70 |

---

## 10. Próximos pasos

1. Confirmar precio cerrado dentro del rango (**1.200 / 1.300 / 1.400**) y reglas de comisión del piloto.  
2. Anticipo 50% + kickoff.  
3. Entrega de datos maestros + % de comisión por vendedor + accesos staging.  
4. Go-live + capacitación.  
5. Inicio del plan mensual USD 70 desde el mes 2.

---

## 11. Aceptación

Si está de acuerdo con esta propuesta, favor firmar/confirmar por correo.

**Por el cliente**  
Nombre: ______________________  
Cargo: ______________________  
Firma/fecha: ______________________

**Por el proveedor**  
Nombre: ______________________  
Cargo: ______________________  
Firma/fecha: ______________________

---

## Anexo A — Resumen técnico

- Frontend: React + Vite (PWA-ready)
- Backend: Python FastAPI
- Base de datos: PostgreSQL
- Mapas: Leaflet
- Offline: IndexedDB (visita + venta)
- Hosting: VPS Linux + HTTPS

## Anexo B — Fuera de precio (cotiza aparte)

- Diseño de marca/UI a medida o redesign completo
- Más de 1 migración/carga masiva de Excel
- Capacitación presencial / multi-sede
- Integraciones bancarias o pasarelas
- App nativa en tiendas
- Módulos nuevos (Fase B/C)
- Horas de soporte por encima del tope mensual
