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
| [docs/DECISIONES_Y_ROADMAP.md](docs/DECISIONES_Y_ROADMAP.md) | Decisiones de producto + GPS |
| [docs/REFERENCIA_POWERSTREET.md](docs/REFERENCIA_POWERSTREET.md) | Referencia competitiva PowerStreet Mobile |
| [mvp/README.md](mvp/README.md) | API |
| [web/README.md](web/README.md) | Frontend |

## Git

1. Una sub-fase → commit local.  
2. **Tú** haces `git push` / `git pull`.  

## Arranque dual (API + Web)

```bash
# Terminal 1 — API
cd mvp
source .venv/bin/activate
python seed.py          # primera vez o para enriquecer demo
uvicorn app.main:app --host 0.0.0.0 --port 8090

# Terminal 2 — Web (Node 20+)
export NVM_DIR="$HOME/.nvm" && . "$NVM_DIR/nvm.sh"   # si usas nvm
cd web
npm install             # primera vez
npm run dev
```

- API + docs: http://localhost:8090/docs  
- Web: http://localhost:5173  
- Login demo: `marina@bitacora.local` / `demo1234`
