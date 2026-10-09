#!/usr/bin/env bash
# Startet BazarPro lokal mit Demo-Daten für die Screenshots:
# selbst gehostetes Convex-Backend (Docker) + App-Frontend (Vite).
#
#   BAZARPRO_DIR=../core ./scripts/demo-stack.sh
#
# Stoppen: docker rm -f bazarpro-docs-convex  (und Vite mit Strg+C)
set -euo pipefail

BAZARPRO_DIR="${BAZARPRO_DIR:-../core}"
CONVEX_VERSION="${CONVEX_VERSION:-5c7cb5bc7db457290f1769f95f1d1340912f7fd7}"
APP_PORT="${APP_PORT:-5199}"

docker rm -f bazarpro-docs-convex >/dev/null 2>&1 || true
docker run -d --name bazarpro-docs-convex \
  -p 127.0.0.1:3210:3210 -p 127.0.0.1:3211:3211 \
  -e CONVEX_CLOUD_ORIGIN=http://127.0.0.1:3210 \
  -e CONVEX_SITE_ORIGIN=http://127.0.0.1:3211 \
  "ghcr.io/get-convex/convex-backend:${CONVEX_VERSION}" >/dev/null
until curl -sf -o /dev/null http://127.0.0.1:3210/version; do sleep 2; done

cd "$BAZARPRO_DIR"
export CONVEX_SELF_HOSTED_URL=http://127.0.0.1:3210
CONVEX_SELF_HOSTED_ADMIN_KEY="$(docker exec bazarpro-docs-convex ./generate_admin_key.sh | grep '|' | tail -1)"
export CONVEX_SELF_HOSTED_ADMIN_KEY
unset CONVEX_DEPLOYMENT CONVEX_DEPLOY_KEY

npx convex deploy -y

# Schlüssel für Convex Auth (wie in der Pipeline von BazarPro)
KEYS="$(node -e "
(async () => {
  const { exportJWK, exportPKCS8, generateKeyPair } = await import('jose');
  const keys = await generateKeyPair('RS256', { extractable: true });
  const pk = (await exportPKCS8(keys.privateKey)).trimEnd().replace(/\n/g, ' ');
  const jwks = JSON.stringify({ keys: [{ use: 'sig', ...(await exportJWK(keys.publicKey)) }] });
  process.stdout.write(JSON.stringify({ pk, jwks }));
})();")"
node -e 'process.stdout.write(JSON.parse(process.argv[1]).pk)' "$KEYS" | npx convex env set JWT_PRIVATE_KEY
node -e 'process.stdout.write(JSON.parse(process.argv[1]).jwks)' "$KEYS" | npx convex env set JWKS
npx convex env set SITE_URL "http://127.0.0.1:${APP_PORT}"
npx convex run seed:runSeed

echo "Demo-Backend bereit. Starte das Frontend auf http://127.0.0.1:${APP_PORT} …"
VITE_CONVEX_URL=http://127.0.0.1:3210 npx vite --host 127.0.0.1 --port "$APP_PORT" --strictPort
