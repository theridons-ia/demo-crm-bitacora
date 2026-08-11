# Referencia competitiva — PowerStreet Mobile

Fuentes:

- Vídeo local: `~/Video/MOBILE _ App móvil para vendedores en ruta _ Solución que automatiza procesos de venta y reparto.mp4`
- Demo YouTube (misma pieza): https://youtu.be/lyV1-Jh_M_k
- Sitio: https://power-street.com/ · https://powerstreet.com.br/soluciones.php
- Oferta PyME: https://www.power-street.com/MyPST.php

**Nota:** no se “ve” el MP4 fotograma a fotograma en este entorno; el análisis combina la narración del demo + documentación pública del producto.

Última actualización: 2026-08-11

---

## 1. Qué es PowerStreet

Suite de **ventas en ruta / SFA** (Sales Force Automation) para distribución (bebidas, abarrotes, farma, etc.), con presencia en **17+ países**.

| Módulo | Rol |
|--------|-----|
| **Enterprise / My Enterprise** | Backoffice ERP comercial |
| **Mobile / My Mobile** | App Android del vendedor (online/offline) |
| **GIS / My GIS** | Mapas, rastreo, ruta planificada vs real |
| **Analyzer / My Reports** | BI / KPIs |
| **Reponer Ya!** | B2B pedidos 24/7 del cliente |
| **Televenta** | Pedidos por teléfono |
| **Planometría** | Foto de exhibidor vs planograma |
| **POS Web** | Mostrador |
| **SmartRouting** | Optimización de rutas (más reciente) |

Bitácora Campo **no** pretende ser Enterprise completo. Sí puede ser un **“My Mobile + GIS ligero + back mínimo”** para PyME Venezuela (pocos vendedores, VPS, PWA).

---

## 2. Flujo del vídeo (día del vendedor)

1. Login → descarga maestros (clientes, precios, promos, CxC).
2. Ve **objetivos** (cobertura, frecuencia) por canal (abarrotes, cremerías, farma…).
3. **Libro de rutas** / itinerario + semáforos de tareas + histórico + mapa/Waze.
4. **Inicia visita** → actividades pendientes: preventa, autoventa, reparto, cobranza.
5. Pedido con pops, productos regulares / **imperdonables**, **pedido sugerido**.
6. Resumen + regalos/promos → foto u observación → ticket → fin de visita.
7. Pedidos llegan al backoffice al instante para gestionar reparto.

---

## 3. Funcionalidades Mobile (catálogo público)

- Pedidos: **preventa | autoventa | reparto**
- Facturación en sitio / pagos electrónicos
- Pedidos sugeridos y PopUps promocionales
- Encuestas en PDV
- Gestión de exhibidores
- Georreferencia de clientes + Waze
- Mermas, cambios, devoluciones
- Inicio de visita por código (barcode/QR)
- Fotos en PDV
- Indicadores del vendedor + histórico de ventas
- Alta de clientes en campo
- Inventario a bordo y en bodega
- Offline + sync (Android / handhelds)
- Motivos de no venta, anulaciones, rechazos
- Cuentas por cobrar / liquidación diaria (en My Mobile + Enterprise)

---

## 4. GIS (supervisor) — lo que más importa a Bitácora

- Clientes en mapa + zonas por vendedor
- Rastreo / multirastreo
- Itinerario del día
- **Alerta visita fuera de ruta**
- Ruta definida vs realizada
- Km recorridos, efectividad
- Universo de clientes

Encaja con nuestra decisión de GPS + alertas + mapa supervisor (Fase 1–2).

---

## 5. Qué **sí** tomamos como referencia UX/producto

Prioridad alta (alinear Bitácora):

| Idea | Encaje en nuestras SF |
|------|------------------------|
| Login → sync maestros del día | SF-1.9 (cache clientes/productos) |
| Home con ruta del día + progreso | SF-1.1 → enriquecer Inicio; SF-2.2 |
| Lista de visitas con estado/semáforo | SF-1.3 |
| Abrir visita → checklist de acciones | SF-1.3 + SF-1.7 |
| Pedido dentro de visita | SF-1.7 |
| Motivo de no venta | SF-1.3 (cerrar sin venta) |
| GPS al iniciar/cerrar + alertas lejos | SF-1.4–1.6 |
| Foto evidencia | SF-1.6 |
| Mapa cliente / evidencia | SF-1.10, SF-2.5 |
| Supervisor: ruta asignada + alertas | SF-2.2, SF-2.3 |
| Objetivos simples (visitas del día) | Resumen SF-1.x |
| Canales de cliente (opcional) | Maestro clientes Fase 1–2 |

Prioridad media (después del piloto):

- Pedido sugerido / “imperdonables”
- Preventa vs autoventa como **tipo de visita/pedido** (más fino que solo `Sale.origin`)
- CxC básica / cobranza en visita
- Liquidación del día (arqueo)
- Alta de cliente en campo
- Inventario “a bordo” del camión (además del stock global)

---

## 6. Qué **no** copiamos en el MVP (evitar scope creep)

- ERP Enterprise completo, contabilidad, facturación electrónica fiscal
- Impresión de ticket fiscal / handhelds Android-only (nosotros: **PWA**)
- Integración SAP/Oracle
- Planometría con IA, SmartRouting avanzado
- Reponer Ya! / Televenta / POS como productos separados
- Multirastreo tiempo real 24/7 estilo GIS Enterprise
- Políticas de comisión complejas, backorder, planogramas

Posicionamiento comercial sugerido:

> “Como PowerStreet Mobile, pero liviano para PyME en Venezuela: visitas con prueba GPS, órdenes USD/Bs, offline mínimo, sin ERP gigante.”

---

## 7. Glosario útil (usar en UI / docs)

| Término PS | Significado | En Bitácora |
|------------|-------------|-------------|
| Preventa | Pedido hoy, entrega después | Tipo pedido / visita |
| Autoventa | Vende del stock del camión | Stock + origen visita |
| Reparto | Entrega de pedidos previos | Fase posterior |
| Libro de rutas | Itinerario del día | Ruta del día |
| Imperdonables | SKUs que no pueden faltar | Lista destacada (luego) |
| Drop size | Promedio $ o unidades por pedido | KPI Resumen |
| Cobertura | % clientes visitados del universo | KPI supervisor |
| PDV | Punto de venta (cliente) | Cliente |

---

## 8. Acciones en el repo

- [x] Este documento
- [ ] Revisar SF-1.3/1.7 para checklist de visita inspirado en PS
- [ ] En Inicio (SF-1.x): mostrar “ruta de hoy” + meta de visitas
- [ ] No abrir módulos Enterprise hasta que el piloto de campo funcione
