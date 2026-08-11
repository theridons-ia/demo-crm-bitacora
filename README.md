# demo-crm-bitacora

CRM de campo **Bitácora**: visitas con evidencia GPS, ventas/órdenes e inventario para equipos pequeños de vendedores y supervisores.

## Carpetas

| Ruta | Rol |
|------|-----|
| `demo-crm-bitacora-export/` | Demo visual HTML (prototipo comercial) — referencia de UX |
| `mvp/` | API real FastAPI + PostgreSQL (+ frontend mínimo temporal) |
| `web/` | App React + Vite (design system; PWA en fases siguientes) |
| `docs/` | Propuesta comercial, decisiones y **sub-fases** |

## Documentación

| Doc | Contenido |
|-----|-----------|
| [docs/SUBFASES.md](docs/SUBFASES.md) | Checkpoints SF-x.y para revisar y commitear |
| [docs/DECISIONES_Y_ROADMAP.md](docs/DECISIONES_Y_ROADMAP.md) | Decisiones de producto + GPS |
| [docs/PROPUESTA_COMERCIAL_BITACORA_CAMPO.md](docs/PROPUESTA_COMERCIAL_BITACORA_CAMPO.md) | Propuesta comercial |
| [mvp/README.md](mvp/README.md) | Cómo arrancar la API |
| [web/README.md](web/README.md) | Cómo arrancar el frontend |

## Git (acuerdo de trabajo)

1. Implementamos **una sub-fase** (`SF-x.y`).
2. Revisas en local.
3. Commit local (puedo prepararlo si lo pides).
4. **Tú** haces `git push` y `git pull` cuando quieras.
5. Seguimos con la siguiente SF.

No subir `mvp/.env` ni secretos.

## Arranque rápido

```bash
# Terminal 1 — API
cd mvp && source .venv/bin/activate
uvicorn app.main:app --host 0.0.0.0 --port 8090

# Terminal 2 — Web (requiere Node 20+)
cd web && npm install && npm run dev
```
