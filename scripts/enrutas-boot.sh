#!/usr/bin/env bash
# Tras un apagón: Docker → Postgres → API → Vite HTTPS.
set -u
ROOT="/home/theridon/demo-crm-bitacora"
MVP="$ROOT/mvp"
WEB="$ROOT/web"
LOG="$ROOT/logs"
LOCK="$LOG/enrutas.lock"
API_PID="$LOG/api.watch.pid"
WEB_PID="$LOG/web.watch.pid"
NVM_DIR="${NVM_DIR:-/home/theridon/.nvm}"

mkdir -p "$LOG"
exec 9>"$LOCK"
if ! flock -n 9; then
  echo "$(date -Is) arranque ya en curso — salgo"
  exit 0
fi

log() { echo "$(date -Is) $*"; }

port_up() {
  ss -H -tln 2>/dev/null | grep -qE ":$1[[:space:]]"
}

alive() {
  local f=$1
  [[ -f $f ]] && kill -0 "$(cat "$f")" 2>/dev/null
}

wait_docker() {
  local i=0
  while ! docker info >/dev/null 2>&1; do
    i=$((i + 1))
    if [[ $i -gt 45 ]]; then
      log "ERROR: Docker no arrancó"
      return 1
    fi
    sleep 2
  done
}

wait_port() {
  local port=$1
  local i=0
  while ! port_up "$port"; do
    i=$((i + 1))
    if [[ $i -gt 40 ]]; then
      log "ERROR: timeout puerto $port"
      return 1
    fi
    sleep 2
  done
}

log "esperando Docker…"
wait_docker || exit 1

log "Postgres (docker compose up -d)"
docker compose -f "$MVP/docker-compose.yml" --project-directory "$MVP" up -d
wait_port 5432 || exit 1

if alive "$API_PID" || port_up 8090; then
  log "API ya estaba en :8090"
else
  log "API uvicorn :8090"
  nohup bash -c "
    cd \"$MVP\"
    while true; do
      PYTHONUNBUFFERED=1 \"$MVP/.venv/bin/uvicorn\" app.main:app --host 0.0.0.0 --port 8090
      echo \"\$(date -Is) uvicorn salió \$?. Reintento en 3s\"
      sleep 3
    done
  " >>"$LOG/api.log" 2>&1 &
  echo $! >"$API_PID"
fi

if alive "$WEB_PID" || port_up 5173; then
  log "Web ya estaba en :5173"
else
  log "Web Vite HTTPS :5173"
  nohup bash -c "
    export NVM_DIR=\"$NVM_DIR\"
    . \"\$NVM_DIR/nvm.sh\"
    cd \"$WEB\"
    while true; do
      npm run dev:https
      echo \"\$(date -Is) vite salió \$?. Reintento en 3s\"
      sleep 3
    done
  " >>"$LOG/web.log" 2>&1 &
  echo $! >"$WEB_PID"
fi

wait_port 8090 || true
wait_port 5173 || true
log "listo  postgres=:5432 api=:8090 web=:5173"
exit 0
