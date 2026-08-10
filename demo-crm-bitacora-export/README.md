# demo-crm-bitacora

Demo web mobile-first para presentar una app de control comercial:

- bitácora de visitas de vendedores
- registro de ventas por visita
- KPIs diarios rápidos
- panel gerencial simple

## Ejecutar local

No requiere dependencias. Puedes abrir `index.html` directamente en el navegador.

Si quieres servirlo por HTTP:

```bash
python3 -m http.server 8080
```

Luego abre:

- `http://localhost:8080`

## Notas

- Es una demo visual (no backend real).
- Los datos se guardan en `localStorage` del navegador para simular uso.
- Ideal para reuniones de descubrimiento y validación funcional.
