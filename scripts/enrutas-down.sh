#!/usr/bin/env bash
# Para API y Vite. Postgres sigue (Docker). Usa --db para bajar también la DB.
set -u
ROOT="/home/theridon/demo-crm-bitacora"
LOG="$ROOT/logs"
API_PID="$LOG/api.watch.pid"
WEB_PID="$LOG/web.watch.pid"

kill_pidfile() {
  local f=$1
  if [[ -f $f ]]; then
    local pid
    pid=$(cat "$f")
    if kill -0 "$pid" 2>/dev/null; then
      kill "$pid" 2>/dev/null || true
      sleep 0.4
      kill -9 "$pid" 2>/dev/null || true
    fi
    rm -f "$f"
  fi
}

kill_pidfile "$API_PID"
kill_pidfile "$WEB_PID"
pkill -f "$ROOT/mvp/.venv/bin/uvicorn app.main:app" 2>/dev/null || true
pkill -f "$ROOT/web/node_modules/.bin/vite" 2>/dev/null || true

if [[ "${1:-}" == "--db" ]]; then
  docker compose -f "$ROOT/mvp/docker-compose.yml" --project-directory "$ROOT/mvp" stop
fi

echo "bajado API/web${1:+ y $1}"
