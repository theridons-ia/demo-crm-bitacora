# Arranque local — Bitácora Campo / EnRutas

Guía para levantar **todo** en tu máquina (después de un apagón, reinicio o primer día).

Necesitas **3 piezas** corriendo a la vez:

| Pieza | Qué es | Puerto |
|-------|--------|--------|
| Postgres | Base de datos (Docker) | `5432` |
| API | FastAPI + uvicorn | `8090` |
| Web | React + Vite | `5173` |

Usa **3 terminales** (o deja 2 en background). No mezcles los comandos en el mismo directorio sin cambiar de carpeta.

Tras un **apagón** ya no hace falta pegar esos comandos a mano: Docker arranca solo, Postgres tiene `restart: unless-stopped`, y crontab `@reboot` corre `scripts/enrutas-boot.sh` (API + Vite HTTPS).

```bash
~/demo-crm-bitacora/scripts/enrutas-status.sh   # ¿está todo arriba?
~/demo-crm-bitacora/scripts/enrutas-boot.sh     # levantar ahora (idempotente)
~/demo-crm-bitacora/scripts/enrutas-down.sh     # bajar API y web
~/demo-crm-bitacora/scripts/enrutas-down.sh --db  # también Postgres
```

Logs: `~/demo-crm-bitacora/logs/{boot,api,web}.log`.

---

## 0. Una sola vez (solo si es máquina nueva)

```bash
# Node (si usas nvm)
export NVM_DIR="$HOME/.nvm" && . "$NVM_DIR/nvm.sh"
nvm use 20   # o la versión que ya tengas ≥18

# Dependencias web
cd ~/demo-crm-bitacora/web
npm install

# Entorno Python API
cd ~/demo-crm-bitacora/mvp
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# Primera vez: datos demo
python seed.py
```

Login demo (después de seed):

- Email: `marina@bitacora.local`
- Password: `demo1234`

También existen `supervisor@bitacora.local` y `admin@bitacora.local` (misma password).

---

## 1. Terminal A — Postgres (Docker)

```bash
cd ~/demo-crm-bitacora/mvp
docker compose up -d
```

### ¿Está bien?

```bash
docker compose ps
```

Debes ver el contenedor `mvp-db-1` (o similar) en estado **Up** y el puerto `5432`.

También:

```bash
ss -tlnp | grep 5432
# o:
curl -s http://127.0.0.1:8090/api/health
# (este último solo responde cuando la API ya está arriba)
```

### ¿Está mal?

- `Cannot connect to the Docker daemon` → Docker no está corriendo: `sudo systemctl start docker`
- Contenedor `Exit` / `Restarting` → mira logs: `docker compose logs db --tail 50`
- Puerto ocupado → algo más usa el 5432; detén ese proceso o cambia el mapeo en `docker-compose.yml`

Para parar solo la DB:

```bash
cd ~/demo-crm-bitacora/mvp
docker compose stop
```

---

## 2. Terminal B — API (uvicorn)

**Importante:** hay que activar el venv. Sin eso verás `Command 'uvicorn' not found`.  
**No** instales uvicorn con `sudo apt install uvicorn`.

```bash
cd ~/demo-crm-bitacora/mvp
source .venv/bin/activate
uvicorn app.main:app --host 0.0.0.0 --port 8090
```

Deja esta terminal abierta. Debes ver algo como:

```text
INFO:     Uvicorn running on http://0.0.0.0:8090
INFO:     Application startup complete
```

### ¿Está bien?

En otra terminal o el navegador:

```bash
curl -s http://127.0.0.1:8090/api/health
```

Respuesta esperada:

```json
{"ok":true,"app":"Bitácora Campo MVP"}
```

También abre: [http://localhost:8090/docs](http://localhost:8090/docs) — la documentación Swagger.

Prueba de login (opcional):

```bash
curl -s -X POST http://127.0.0.1:8090/api/auth/login \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  -d 'username=marina@bitacora.local&password=demo1234'
```

Debe devolver un JSON con `access_token`.

### ¿Está mal?

| Síntoma | Causa probable | Qué hacer |
|---------|----------------|-----------|
| `uvicorn: command not found` | Venv no activado | `source .venv/bin/activate` dentro de `mvp/` |
| Error de conexión a Postgres / `OperationalError` | DB apagada o aún arrancando | `docker compose up -d`, espera 2–3 s y reintenta |
| `Address already in use` (8090) | Ya hay un uvicorn viejo | `ss -tlnp \| grep 8090` y mata el PID, o usa otro puerto |
| Arranca y muere al instante | Falta `.env` o dependencia | Revisa el traceback; `pip install -r requirements.txt` |

Para detener la API: en esa terminal `Ctrl+C`.

---

## 3. Terminal C — Web (Vite)

### Solo en el PC (HTTP)

```bash
export NVM_DIR="$HOME/.nvm" && . "$NVM_DIR/nvm.sh"
cd ~/demo-crm-bitacora/web
npm run dev -- --host
```

Abre: [http://localhost:5173](http://localhost:5173)

### Con GPS en el celular (HTTPS recomendado)

```bash
export NVM_DIR="$HOME/.nvm" && . "$NVM_DIR/nvm.sh"
cd ~/demo-crm-bitacora/web
npm run dev:https
```

Abre en el PC: `https://localhost:5173`  
En el celular (misma Wi‑Fi): `https://IP-DE-TU-PC:5173`  
(la IP aparece en la salida de Vite como **Network**).

El navegador avisará certificado autofirmado: acepta / “Avanzado → continuar”.

### ¿Está bien?

- Vite imprime `ready in … ms` y una URL **Local** / **Network**
- La página de login carga
- Tras login ves Inicio / Visitas / Ventas, etc.
- En DevTools → Network, las llamadas a `/api/...` responden **200** (no 502/Failed to fetch)

### ¿Está mal?

| Síntoma | Causa probable | Qué hacer |
|---------|----------------|-----------|
| `npm: command not found` | nvm/node no cargado | `export NVM_DIR=…` y `. "$NVM_DIR/nvm.sh"` |
| Página en blanco / error de módulos | Faltan deps | `npm install` en `web/` |
| Login “Failed to fetch” / CORS | API caída o puerto distinto | Verifica Terminal B y `/api/health` |
| GPS bloqueado en el celular | Estás en `http://IP` sin HTTPS | Usa `npm run dev:https` |
| Puerto 5173 ocupado | Vite anterior vivo | Mátalo o deja que Vite use otro puerto y ábrelo |

Para detener Vite: `Ctrl+C` en esa terminal.

---

## Checklist rápido (después de un apagón)

En esta máquina el arranque es **automático** (crontab `@reboot` → `scripts/enrutas-boot.sh`). Espera ~30–60 s a que Docker y Postgres suban, luego:

```bash
~/demo-crm-bitacora/scripts/enrutas-status.sh
```

Debes ver `5432`, `8090`, `5173` y `{"ok":true,...}` en health.

Si algo no levantó:

```bash
~/demo-crm-bitacora/scripts/enrutas-boot.sh
tail -50 ~/demo-crm-bitacora/logs/boot.log
```

Arranque manual (sin crontab), en orden:

```bash
# 1) DB
cd ~/demo-crm-bitacora/mvp && docker compose up -d

# 2) API (terminal aparte)
cd ~/demo-crm-bitacora/mvp
source .venv/bin/activate
uvicorn app.main:app --host 0.0.0.0 --port 8090

# 3) Web (otra terminal)
export NVM_DIR="$HOME/.nvm" && . "$NVM_DIR/nvm.sh"
cd ~/demo-crm-bitacora/web
npm run dev:https
```

Verificación en 30 segundos:

```bash
docker compose -f ~/demo-crm-bitacora/mvp/docker-compose.yml ps
curl -s http://127.0.0.1:8090/api/health
ss -tlnp | grep -E '5432|8090|5173'
```

- `5432` → Postgres  
- `8090` → API  
- `5173` → Web  

Si faltan puertos, esa pieza no está arriba.

---

## Cómo saber que “todo el producto” funciona (smoke test)

1. Abre la web y entra con `marina@bitacora.local` / `demo1234`.
2. **Inicio:** ves lista de clientes (o cache offline si ya entraste antes).
3. **Visitas:** crea o abre una visita; inicia/cierra si quieres.
4. **Ventas:** lista carga; “Nueva” abre el formulario.
5. **Inventario:** productos con stock.
6. Con HTTPS en el celular: el GPS no debe decir que el origen es inseguro.

Si el login falla pero `/api/health` está ok, corre de nuevo el seed:

```bash
cd ~/demo-crm-bitacora/mvp
source .venv/bin/activate
python seed.py
```

---

## Errores típicos post-apagón

1. **Olvidaste el venv** → `uvicorn not found` → `source .venv/bin/activate`
2. **Olvidaste Docker** → API falla al conectar DB → `docker compose up -d`
3. **Vite/API “fantasma”** en otro PID → puertos ocupados → `ss -tlnp | grep -E '8090|5173'` y `kill PID`
4. **Solo abres la web** sin API → Failed to fetch en login

---

## URLs de referencia

| Servicio | URL |
|----------|-----|
| Health API | http://localhost:8090/api/health |
| Docs API | http://localhost:8090/docs |
| Web HTTP | http://localhost:5173 |
| Web HTTPS (GPS móvil) | https://localhost:5173 |

Proyecto: `~/demo-crm-bitacora`  
Más contexto de producto: `docs/SUBFASES.md`, `docs/DECISIONES_Y_ROADMAP.md`.
