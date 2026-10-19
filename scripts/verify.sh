#!/usr/bin/env bash
# One command to check everything before a merge or a deploy:
#   scripts/verify.sh              # api tests, web types + lint + unit tests, then the browser tests (e2e/run.sh)
#   scripts/verify.sh --no-e2e     # skip the browser tests (about 5 minutes saved)
#   scripts/verify.sh --no-api     # skip the api tests (about 12 minutes saved)
# Stops at the first failing step. Uses throwaway databases only (db-test :55432 and e2e :55434).
set -uo pipefail
cd "$(dirname "$0")/.."
RUN_API=1; RUN_E2E=1
for arg in "$@"; do
  case "$arg" in --no-e2e) RUN_E2E=0;; --no-api) RUN_API=0;; *) echo "unknown option $arg" >&2; exit 2;; esac
done
step() { echo; echo "=== $1"; shift; local t=$SECONDS; if "$@"; then echo "--- ok ($((SECONDS - t))s)"; else echo "--- FAILED: $*" >&2; exit 1; fi; }

if [ "$RUN_API" = 1 ]; then
  step "api: database for tests" bash -c 'cd genealogy-api && docker compose up -d --wait db-test'
  step "api: pytest" bash -c 'cd genealogy-api && .venv/bin/pytest -q'
fi
step "web: types" bash -c 'cd genealogy-web && npx tsc --noEmit'
step "web: lint" bash -c 'cd genealogy-web && npm run lint'
step "web: unit tests" bash -c 'cd genealogy-web && npx vitest run'
if [ "$RUN_E2E" = 1 ]; then
  step "e2e: browser tests" e2e/run.sh
fi
echo; echo "ALL GOOD"
