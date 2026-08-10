# Handoff para nuevo Cloud Agent (demo-crm-bitacora)

## Objetivo
Continuar este proyecto como repositorio independiente para una demo comercial móvil de CRM de vendedores.

## Estado actual del demo
Proyecto frontend estático, mobile-first, sin backend:

- `index.html`: layout principal con
  - KPIs
  - formulario "Registrar visita"
  - lista de últimas visitas
  - panel gerencial rápido
- `styles.css`: estilos responsive y tarjetas
- `app.js`: lógica de demo con `localStorage`
  - guarda visitas
  - captura GPS (Geolocation + reverse geocode)
  - foto opcional del establecimiento (comprimida)
  - calcula KPIs (visitas, ventas, efectividad)
  - leaderboard simple por vendedor
  - botón para limpiar demo
- `README.md`: instrucciones de ejecución

## Cómo ejecutar
```bash
python3 -m http.server 8080
```

Abrir la app desde el puerto 8080 (preview/forwarded port en Cursor).

## Próximos pasos sugeridos
1. Subir estos archivos al repo remoto `theridons-ia/demo-crm-bitacora`.
2. Crear versión v2 con:
   - pantalla detalle por vendedor/ruta
   - filtros por fecha/estado
   - dashboard de supervisor separado
3. (Opcional) Migrar a backend real (Django/FastAPI + PostgreSQL) tras validación de negocio.
