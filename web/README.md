# Bitácora Campo — Web (React + Vite)

Frontend PWA del CRM (en construcción). Design tokens alineados a `demo-crm-bitacora-export/`.

## Requisitos

- Node.js **20+** (recomendado 22 LTS)
- API MVP corriendo en `http://localhost:8090` (ver `../mvp/README.md`)

### Instalar Node (una vez, en tu máquina)

Si no tienes `node` / `npm`:

```bash
# Opción A — nvm (recomendado, sin sudo)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash
# reinicia la terminal, luego:
nvm install 22
```

O instala Node desde https://nodejs.org /

## Arrancar

```bash
cd web
npm install
npm run dev
```

Abre la URL que imprima Vite (normalmente `http://localhost:5173`).

## Scripts

| Comando | Qué hace |
|---------|----------|
| `npm run dev` | HTTP en localhost |
| `npm run dev:host` | HTTP accesible en la LAN |
| `npm run dev:https` | **HTTPS** en LAN (para GPS en el celular) |
| `npm run build` | Build producción en `dist/` |
| `npm run preview` | Sirve el build |

## HTTPS local (GPS en el celular)

1. Deja la **API** corriendo (`uvicorn` en `:8090`).
2. Para el front anterior (Ctrl+C) y arranca:

```bash
cd web
export NVM_DIR="$HOME/.nvm" && . "$NVM_DIR/nvm.sh"
npm run dev:https
```

3. Vite mostrará algo como `https://192.168.x.x:5173/`.
4. En el celular (misma Wi‑Fi), abre esa URL **https**.
5. El navegador avisará “certificado no confiable” → **Avanzado → Continuar** (es normal en local).
6. Login y prueba Visitas + GPS (pide permiso de ubicación).

Notas:

- El proxy `/api` sigue yendo a `http://127.0.0.1:8090` en el servidor; el celular solo habla con Vite por HTTPS.
- Si no carga, revisa firewall del PC (puerto 5173).
- En el PC también puedes usar `https://localhost:5173`.

## Estructura

```
web/
  src/
    styles/tokens.css   # paleta y radios (design system)
    styles/base.css     # reset + tipografía + botones base
    components/         # UI reutilizable
    pages/              # pantallas por ruta
    lib/                # api client, auth, gps helpers
    App.tsx
    main.tsx
```

## Sub-fase

Ver `../docs/SUBFASES.md`.

- **SF-0.1** — scaffold + design tokens  
- **SF-0.2** — login JWT + listado de clientes (`/login`, `/clientes`)
- **SF-1.1** — shell vendedor: `/app/inicio|visitas|ventas|inventario|resumen` + bottom nav

### Probar login

Con API en `:8090` y `npm run dev`:

1. Abre http://localhost:5173/login  
2. `marina@bitacora.local` / `demo1234`  
3. Entras a `/app/inicio` con barra inferior.
