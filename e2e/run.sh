#!/usr/bin/env bash
# Browser tests of the whole stack on a THROWAWAY database (never the real one).
#
#   ./run.sh                 # everything
#   ./run.sh editor          # only suites whose file name contains "editor"
#   E2E_SKIP_BUILD=1 ./run.sh   # reuse the last production build of the web app (made by this script)
#   E2E_AUDIT=full ./run.sh     # the contrast/target audit on 4 themes x 4 widths (default: quick = 2 themes x 2 widths)
#   KEEP_STACK=1 ./run.sh       # leave the throwaway stack running afterwards (web :3101, api :8101, db :55434)
#
# Needs: docker (a throwaway postgres), genealogy-api/.venv (uv sync), node + `npm i` in genealogy-web and in e2e/, and a chromium
# (the one Playwright caches in ~/.cache/ms-playwright, or CHROMIUM_PATH). It never touches the compose stack or ports 3000/8000/5432.
# Do not run it while `npm run dev` is running in genealogy-web (both use .next).
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
E2E="$ROOT/e2e"
PG=gia-pha-e2e-pg; PG_PORT=55434; API_PORT=8101; WEB_PORT=3101
FILTER="${1:-}"
API_URL="http://127.0.0.1:$API_PORT"
mkdir -p "$E2E/out"; rm -f "$E2E/state.json"

pids=()
cleanup() {
  [ -n "${KEEP_STACK:-}" ] && { echo "stack left running (KEEP_STACK=1): web :$WEB_PORT api :$API_PORT db :$PG_PORT"; return; }
  for pid in "${pids[@]:-}"; do [ -n "$pid" ] && kill "$pid" 2>/dev/null; done
  docker rm -f "$PG" >/dev/null 2>&1
}
trap cleanup EXIT

command -v docker >/dev/null || { echo "docker is needed" >&2; exit 2; }
[ -x "$ROOT/genealogy-api/.venv/bin/uvicorn" ] || { echo "run 'uv sync' in genealogy-api first" >&2; exit 2; }
[ -d "$E2E/node_modules/playwright-core" ] || (cd "$E2E" && npm install --no-audit --no-fund >/dev/null) || exit 2

echo "== database"
docker rm -f "$PG" >/dev/null 2>&1
docker run -d --rm --name "$PG" -e POSTGRES_PASSWORD=e2e -e POSTGRES_DB=genealogy_e2e -p 127.0.0.1:$PG_PORT:5432 postgres:18.6 >/dev/null || exit 2
for _ in $(seq 1 40); do docker exec "$PG" pg_isready -U postgres -d genealogy_e2e >/dev/null 2>&1 && break; sleep 1; done

echo "== api"
cd "$ROOT/genealogy-api"
export POSTGRES_HOST=127.0.0.1 POSTGRES_PORT=$PG_PORT POSTGRES_USER=postgres POSTGRES_PASSWORD=e2e POSTGRES_DB=genealogy_e2e
export JWT_SECRET=e2e-secret-0123456789abcdef0123456789abcdef FRONTEND_ORIGIN="http://127.0.0.1:$WEB_PORT"
export UPLOAD_DIR="$E2E/out/uploads" BACKUP_DIR="$E2E/out/backups" RATE_LIMIT_ENABLED=false
unset DATABASE_URL
rm -rf "$UPLOAD_DIR" "$BACKUP_DIR"; mkdir -p "$UPLOAD_DIR" "$BACKUP_DIR"
.venv/bin/python -c "from app.core.config import get_settings as g; print('database:', g().database_url.split('@')[1])"
.venv/bin/alembic upgrade head >"$E2E/out/api-migrate.log" 2>&1 || { tail -5 "$E2E/out/api-migrate.log"; exit 2; }
.venv/bin/uvicorn app.main:app --port $API_PORT >"$E2E/out/api.log" 2>&1 & pids+=($!)
for _ in $(seq 1 30); do curl -sf "$API_URL/health" >/dev/null && break; sleep 1; done
curl -sf "$API_URL/health" >/dev/null || { echo "api did not start (see e2e/out/api.log)" >&2; exit 2; }
.venv/bin/python scripts/manage.py create-user --email root@example.com --name Root --role superadmin --password password-123 | tail -1

echo "== web (production build)"
cd "$ROOT/genealogy-web"
if [ -z "${E2E_SKIP_BUILD:-}" ] || [ "$(cat .next/.e2e-api 2>/dev/null)" != "$API_URL" ]; then
  rm -rf .next
  API_BASE_URL="$API_URL" npm run build >"$E2E/out/web-build.log" 2>&1 || { tail -15 "$E2E/out/web-build.log"; exit 2; }
  echo "$API_URL" > .next/.e2e-api
fi
API_BASE_URL="$API_URL" npx next start -p $WEB_PORT -H 127.0.0.1 >"$E2E/out/web.log" 2>&1 & pids+=($!)
for _ in $(seq 1 30); do curl -sf "http://127.0.0.1:$WEB_PORT/login" >/dev/null && break; sleep 1; done
curl -sf "http://127.0.0.1:$WEB_PORT/login" >/dev/null || { echo "web did not start (see e2e/out/web.log)" >&2; exit 2; }

cd "$E2E"
export E2E_WEB="http://127.0.0.1:$WEB_PORT" E2E_AUDIT="${E2E_AUDIT:-quick}"
results=(); fail=0
run_suite() {
  local file="$1" name; name="$(basename "$file" .mjs)"
  [ -n "$FILTER" ] && [[ "$name" != *"$FILTER"* ]] && return
  echo; echo "== suite $name"
  if node "$file" 2>&1 | tee "$E2E/out/$name.log" | grep -E "^(FAIL|\s*[0-9]+ check)" ; then :; fi
  if grep -q "^FAIL" "$E2E/out/$name.log" || ! grep -q "all checks passed" "$E2E/out/$name.log"; then results+=("FAIL  $name"); fail=1; else results+=("ok    $name ($(grep -c '^PASS' "$E2E/out/$name.log") checks)"); fi
}
run_suite suites/00-fresh-install.mjs            # before the seed: nobody has made a family yet
echo; echo "== seed"; node seed.mjs 2>&1 | grep -E "FAIL|passed" || true
[ -f state.json ] || { echo "seed failed (see e2e/out)" >&2; exit 2; }
for f in suites/[1-9]*.mjs; do run_suite "$f"; done

echo; echo "== summary"; printf '%s\n' "${results[@]}"
exit $fail
