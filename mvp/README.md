# Bitácora Campo — MVP (FastAPI + PostgreSQL)

MVP online-first con cola offline mínima para **visita + GPS (+ venta)**.

## Incluye
- Usuarios/roles: `vendedor`, `supervisor`, `admin`
- Clientes, proveedores, productos/inventario
- Visitas con GPS + descripción
- Ventas ligadas a visita (descuenta stock)
- Sync offline: `/api/sync/offline-visits`
- Frontend HTML simple servido por FastAPI

## Requisitos
- Python 3.12+
- PostgreSQL

## Setup local
```bash
cd mvp
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# configurar .env (ya hay uno de ejemplo)
# DATABASE_URL=postgresql+psycopg2://bitacora:bitacora@127.0.0.1:5432/bitacora_mvp

python seed.py
uvicorn app.main:app --reload --host 0.0.0.0 --port 8090
```

Abrir: `http://localhost:8090`

### Usuarios demo
- `marina@bitacora.local` / `demo1234` (vendedor)
- `supervisor@bitacora.local` / `demo1234`
- `admin@bitacora.local` / `demo1234`

## API docs
`http://localhost:8090/docs`

## Notas de alcance
- Offline solo para visita/GPS/venta en cola local
- Inventario/créditos avanzados/multimoneda completa: fases siguientes
- El demo estático anterior sigue en `demo-crm-bitacora-export/`
