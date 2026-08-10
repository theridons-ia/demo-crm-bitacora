# demo-crm-bitacora

Demo web mobile-first para presentar una app de control comercial:

- bitácora de visitas de vendedores
- registro de ventas por visita
- captura de ubicación GPS (dirección + coordenadas)
- foto opcional del establecimiento como evidencia
- filtros por fecha, estado y resultado
- detalle por vendedor/ruta
- dashboard de supervisor separado
- KPIs diarios rápidos

## Ejecutar local

No requiere dependencias. Puedes abrir `index.html` directamente en el navegador.

Si quieres servirlo por HTTP:

```bash
python3 -m http.server 8080
```

Luego abre:

- Vendedor: `http://localhost:8080/index.html`
- Supervisor: `http://localhost:8080/supervisor.html`

## Notas

- Es una demo visual (no backend real).
- Los datos se guardan en `localStorage` del navegador para simular uso.
- Usa **Datos demo** / **Cargar datos demo** para poblar visitas de ejemplo.
- Ideal para reuniones de descubrimiento y validación funcional.
