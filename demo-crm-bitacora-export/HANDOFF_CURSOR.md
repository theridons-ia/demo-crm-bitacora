# Handoff para nuevo Cloud Agent (demo-crm-bitacora)

## Objetivo
Continuar este proyecto como repositorio independiente para una demo comercial móvil de CRM de vendedores.

## Estado actual del demo (Fase 2)
Proyecto frontend estático, mobile-first, sin backend:

- `index.html` + `app.js`: panel del vendedor
  - selección de vendedor/ruta
  - KPIs filtrados
  - filtros por fecha/estado/resultado
  - formulario de visita (GPS + foto opcional)
  - pantalla detalle de ruta del vendedor
- `supervisor.html` + `supervisor.js`: dashboard de supervisor
  - filtros del equipo
  - ranking clickable
  - detalle por vendedor/ruta
  - actividad reciente
- `shared.js`: storage, sellers, filtros, seed demo, helpers
- `styles.css`: estilos responsive compartidos
- `README.md`: instrucciones de ejecución

## Cómo ejecutar
```bash
python3 -m http.server 8080
```

Abrir:

- `http://localhost:8080/index.html` (vendedor)
- `http://localhost:8080/supervisor.html` (supervisor)

## Próximos pasos sugeridos
1. Pulir UX demo (onboarding, estados vacíos, branding cliente).
2. (Opcional) Migrar a backend real (Django/FastAPI + PostgreSQL) tras validación de negocio.
3. Autenticación por rol (vendedor vs supervisor) y sync offline.
