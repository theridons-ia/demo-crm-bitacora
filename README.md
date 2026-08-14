# demo-crm-bitacora

CRM de campo **Bitácora**: visitas con evidencia GPS, ventas/órdenes e inventario para equipos pequeños de vendedores y supervisores (contexto Venezuela: RIF/CI).

## Carpetas

| Ruta | Rol |
|------|-----|
| `demo-crm-bitacora-export/` | Demo visual HTML (prototipo comercial) — referencia de UX |
| `mvp/` | API FastAPI + PostgreSQL (+ frontend HTML mínimo temporal) |
| `web/` | App React + Vite (UI real en construcción) |
| `docs/` | Propuesta, decisiones y sub-fases |

## Documentación

| Doc | Contenido |
|-----|-----------|
| [docs/SUBFASES.md](docs/SUBFASES.md) | Checkpoints SF-x.y |
| [docs/implementacion/](docs/implementacion/README.md) | Qué se hizo y cómo (por fase) |
| [docs/ARRANQUE_LOCAL.md](docs/ARRANQUE_LOCAL.md) | Cómo levantar API + web y verificar |
| [docs/DECISIONES_Y_ROADMAP.md](docs/DECISIONES_Y_ROADMAP.md) | Decisiones de producto + GPS |
| [docs/REFERENCIA_POWERSTREET.md](docs/REFERENCIA_POWERSTREET.md) | Referencia competitiva PowerStreet Mobile |
| [mvp/README.md](mvp/README.md) | API |
| [web/README.md](web/README.md) | Frontend |

## Git

1. Una sub-fase → commit local.  
2. **Tú** haces `git push` / `git pull`.  

## Arranque dual (API + Web)

**Guía detallada (apagón / checklist / verificación):** [docs/ARRANQUE_LOCAL.md](docs/ARRANQUE_LOCAL.md)

En el servidor de demo el stack se levanta **solo** al encender (`scripts/enrutas-boot.sh` + Docker `restart: unless-stopped`). A mano:

```bash
~/demo-crm-bitacora/scripts/enrutas-boot.sh

# o las 3 terminales de siempre:
# Terminal 0 — Postgres (si no está)
cd mvp && docker compose up -d

# Terminal 1 — API
cd mvp
source .venv/bin/activate
python seed.py          # primera vez o para enriquecer demo
uvicorn app.main:app --host 0.0.0.0 --port 8090

# Terminal 2 — Web (Node 20+)
export NVM_DIR="$HOME/.nvm" && . "$NVM_DIR/nvm.sh"   # si usas nvm
cd web
npm install             # primera vez
npm run dev -- --host   # --host permite abrir desde otro dispositivo en la LAN
# GPS en celular: npm run dev:https
```

- API + docs: http://localhost:8090/docs  
- Web: http://localhost:5173  
- Login demo: `marina@bitacora.local` / `demo1234`

**GPS en el celular:** hace falta **HTTPS** (o `localhost`). Por `http://IP:5173` el navegador suele bloquear la ubicación; ver `docs/SUBFASES.md` (SF-1.4).
