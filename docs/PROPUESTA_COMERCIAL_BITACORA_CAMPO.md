# Propuesta comercial  
## Bitácora Campo — CRM de visitas y ventas de campo

**Preparada para:** [Nombre del cliente]  
**Preparada por:** Theridon / [Tu razón social]  
**Fecha:** [Completar]  
**Validez de la oferta:** 15 días  
**Moneda de cotización:** USD (dólares estadounidenses)

---

## 1. Entendimiento del negocio

Hoy la operación comercial se apoya principalmente en **archivos Excel**, sin ERP.  
El dolor prioritario es **dar fe de que el vendedor visitó realmente al cliente**, con evidencia de ubicación, y poder registrar la actividad comercial de forma ordenada.

La solución propuesta es una **aplicación web (PWA)** usable en celular, tablet y laptop, con panel para administración/supervisión.

---

## 2. Objetivo del proyecto

Construir un sistema que permita:

1. Registrar visitas de vendedores con **prueba GPS**.
2. Asociar ventas a esas visitas (con productos e inventario básico).
3. Permitir trabajo de campo **aunque se pierda señal**, guardando localmente la visita+GPS(+venta) y subiéndola al recuperar conexión.
4. Centralizar clientes, usuarios, proveedores e inventario en una base de datos real (PostgreSQL), dejando atrás el Excel como fuente principal.

---

## 3. Alcance del MVP (Fase 1)

### Incluye
- Login por usuario y roles: **vendedor**, **supervisor**, **admin**
- Maestros básicos:
  - Clientes
  - Proveedores (alta/listado)
  - Productos e inventario (stock y precio base)
- Bitácora de visitas:
  - Crear / cerrar visita
  - Descripción de la visita
  - Captura GPS (latitud, longitud, precisión, fecha/hora)
  - Indicador si se capturó sin conexión
- Ventas ligadas a visita:
  - Productos y cantidades
  - Descuento de inventario
  - Moneda base USD (extensible luego)
- Cola offline mínima:
  - Solo visita + GPS + venta asociada
  - Sincronización automática al recuperar internet
- Panel simple para consultar visitas y evidencias
- Importación inicial desde Excel (clientes/productos) — 1 carga asistida
- Capacitaciones: 1 sesión remota (hasta 2 horas)
- Hosting inicial en VPS económico + HTTPS

### No incluye en el MVP
- Campos dinámicos ilimitados por visita (se usa descripción)
- Offline total de toda la app
- Contabilidad completa / contabilidad fiscal
- App nativa iOS/Android en tiendas (sí PWA instalable)
- Integraciones con bancos, Zelle, USDT on-chain, SENIAT, etc.
- Ruteo inteligente / optimización de rutas con IA
- Multibodega avanzada
- App de proveedores externos self-service

---

## 4. Fases sugeridas

### Fase 1 — MVP (prioridad del cliente)
**Duración estimada:** 4 a 6 semanas  
Visitas + GPS + ventas básicas + inventario simple + sync offline mínimo + usuarios/roles.

### Fase 2 — Operación comercial
**Duración estimada:** 3 a 5 semanas  
- Ventas a crédito y estado de cuenta  
- Compras a proveedores (contado/crédito)  
- Multimoneda operativa (Bs, USD cash, Zelle, USDT, EUR) con tasa del día  
- Reportes de cobranza y productividad por vendedor  
- Mapa de evidencias GPS para supervisión  

### Fase 3 — Control y escala
**Duración estimada:** 3 a 6 semanas  
- Reglas de territorio / colisiones entre vendedores  
- Reservas de stock y conciliación offline más estricta  
- Notificaciones, metas, ranking  
- Exportaciones avanzadas y tablero gerencial  
- Endurecimiento PWA (instalación, actualizaciones, performance)

---

## 5. Entregables Fase 1

| Entregable | Descripción |
|---|---|
| Aplicación web PWA | Acceso vendedor/supervisor/admin |
| Backend API | FastAPI |
| Base de datos | PostgreSQL |
| Documentación corta | Manual de uso + accesos |
| Código fuente | Repositorio del cliente o acuerdo de licencia |
| Puesta en marcha | VPS + dominio + SSL |

---

## 6. Inversión estimada (mercado Venezuela)

> Las cifras son **estimaciones de referencia en USD** para un desarrollo a medida de este alcance, orientadas a PyME en Venezuela.  
> Se pueden ajustar según urgencia, cantidad de usuarios y si el cliente aporta diseño/contenido.

### Opción A — Paquete MVP (recomendada para empezar)
| Concepto | Estimado |
|---|---|
| Desarrollo Fase 1 (MVP) | **USD 1.800 – 3.200** |
| Puesta en marcha / configuración inicial | **USD 150 – 300** |
| Capacitación inicial | Incluida (1 sesión) |
| **Total arranque** | **USD 1.950 – 3.500** |

### Opción B — MVP + Fase 2 (operación comercial)
| Concepto | Estimado |
|---|---|
| Fase 1 + Fase 2 | **USD 3.800 – 6.500** |

### Costos mensuales recurrentes (aprox.)
| Concepto | Estimado mensual |
|---|---|
| VPS + respaldos + SSL | **USD 15 – 35** |
| Dominio (prorrateado) | **USD 1 – 2** |
| Soporte / mantenimiento ligero | **USD 80 – 200** |
| **Total operación mensual** | **USD 100 – 240** |

### Forma de pago sugerida (Fase 1)
1. **40%** al inicio  
2. **40%** al entregar MVP funcional en staging  
3. **20%** al publicar en producción + capacitación  

---

## 7. Supuestos

- Hasta **20 usuarios** activos en Fase 1 (ampliable).
- El cliente entrega a tiempo: lista de vendedores, clientes, productos y reglas básicas de visita/venta.
- Hay disponibilidad de un responsable del cliente para pruebas semanales.
- Los vendedores usan smartphones con GPS y navegador moderno (Chrome/Safari).
- La evidencia GPS depende del permiso del dispositivo y de condiciones de señal satelital; si no hay GPS, la visita puede guardarse marcada como “sin GPS”.

---

## 8. Beneficios esperados

- Prueba objetiva de presencia en cliente (GPS + timestamp).
- Menos dependencia de Excel y WhatsApp como “sistema”.
- Visibilidad para supervisión/administración.
- Base lista para créditos, multimoneda e inventario más avanzado.
- Costo de infraestructura bajo al inicio y escalable.

---

## 9. Riesgos y mitigación

| Riesgo | Mitigación |
|---|---|
| Señal móvil inestable en ruta | Cola offline solo para visita/GPS/venta |
| Permisos de ubicación denegados | Flujo con marca “sin GPS” + supervisión |
| Alcance crece a “ERP completo” | Fases claras; cambios por addendum |
| Datos iniciales desordenados en Excel | Sesión de limpieza/importación guiada |

---

## 10. Próximos pasos

1. Confirmación de alcance MVP.  
2. Selección de opción A o B.  
3. Anticipo y kickoff.  
4. Entrega de accesos staging en la semana 2 (aprox.).  
5. Go-live Fase 1 según cronograma acordado.

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

## Anexo A — Resumen técnico (no comercial)

- Frontend: HTML/CSS/JS (evolución a PWA; React opcional en fases posteriores)
- Backend: Python FastAPI
- Base de datos: PostgreSQL
- Hosting: VPS Linux
- Prioridad offline: visita + GPS + venta

## Anexo B — Fuera de precio (cotiza aparte)

- Diseño de marca/UI a medida
- Migración histórica grande de Excel (más de 1 importación)
- Capacitación presencial / multi-sede
- Integraciones bancarias o pasarelas
- App nativa en App Store / Play Store
