#!/usr/bin/env bash
set -u
echo "Docker:   $(systemctl is-active docker 2>/dev/null || echo ?)"
docker compose -f /home/theridon/demo-crm-bitacora/mvp/docker-compose.yml \
  --project-directory /home/theridon/demo-crm-bitacora/mvp ps
echo
ss -H -tln 2>/dev/null | grep -E ':5432|:8090|:5173' || echo "(ningún puerto EnRutas)"
echo
curl -sS --max-time 3 http://127.0.0.1:8090/api/health || echo "API no responde"
echo
