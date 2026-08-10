# Bitácora Campo (demo web)

Demo web mobile-first alineada a la interfaz de **Bitácora Campo**:

- navegación inferior: Inicio · Visitas · Resumen
- registro rápido de visita (GPS + foto opcional)
- búsqueda y filtros de historial
- métricas, progreso de ruta y objetivo diario
- panel de supervisor separado
- persistencia local (`localStorage`) offline-first

## Ejecutar

```bash
python3 -m http.server 8080
```

Abrir:

- Vendedor: `http://localhost:8080/index.html`
- Supervisor: `http://localhost:8080/supervisor.html`

## Notas

- No requiere backend.
- La demos siembra 2 visitas de ejemplo al abrir por primera vez.
- Visualmente sigue la guía Bitácora Campo (marfil, verde bosque, coral, Inter).
