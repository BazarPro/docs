#!/usr/bin/env bash
# Startet BazarPro lokal mit Demo-Daten für die Screenshots:
# Postgres (Docker) + Rust-Backend (cargo) + App-Frontend (Vite).
#
#   BAZARPRO_DIR=../core ./scripts/demo-stack.sh
#
# Stoppen: Strg+C beendet Backend und Vite; die Datenbank mit docker rm -f bazarpro-docs-pg
set -euo pipefail

BAZARPRO_DIR="${BAZARPRO_DIR:-../core}"
APP_PORT="${APP_PORT:-5199}"
BACKEND_PORT="${BACKEND_PORT:-3199}"
PG_PORT="${PG_PORT:-55499}"

# Jedes Mal eine frische Datenbank, damit die Demo-Daten zum heutigen Tag passen
docker rm -f bazarpro-docs-pg >/dev/null 2>&1 || true
docker run -d --name bazarpro-docs-pg -p "127.0.0.1:${PG_PORT}:5432" \
  -e POSTGRES_USER=bazarpro -e POSTGRES_PASSWORD=bazarpro -e POSTGRES_DB=bazarpro \
  postgres:17-alpine >/dev/null
until docker exec bazarpro-docs-pg pg_isready -U bazarpro >/dev/null 2>&1; do sleep 1; done

cd "$BAZARPRO_DIR"
export DATABASE_URL="postgres://bazarpro:bazarpro@127.0.0.1:${PG_PORT}/bazarpro"
export LISTEN_ADDR="127.0.0.1:${BACKEND_PORT}"
export SITE_URL="http://127.0.0.1:${APP_PORT}"
export STORAGE_DIR
STORAGE_DIR="$(mktemp -d)"

cargo build --manifest-path backend/Cargo.toml
backend/target/debug/bazarpro-backend seed
backend/target/debug/bazarpro-backend &
BACKEND_PID=$!
trap 'kill "$BACKEND_PID" 2>/dev/null || true' EXIT
until curl -sf -o /dev/null "http://${LISTEN_ADDR}/healthz"; do sleep 1; done

echo "Demo-Backend bereit. Starte das Frontend auf http://127.0.0.1:${APP_PORT} …"
BACKEND_URL="http://${LISTEN_ADDR}" npx vite --host 127.0.0.1 --port "$APP_PORT" --strictPort
