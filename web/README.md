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
| `npm run dev` | Servidor de desarrollo |
| `npm run build` | Build producción en `dist/` |
| `npm run preview` | Sirve el build |

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

Ver `../docs/SUBFASES.md` — este scaffold es **SF-0.1**.
