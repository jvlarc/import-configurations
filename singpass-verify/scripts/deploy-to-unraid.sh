#!/usr/bin/env bash
#
# Run this ON YOUR LAPTOP (which can reach the Unraid server on the LAN).
# It SSHes into Unraid, clones/updates the repo, builds the container, and
# starts it. You still create the .env once (it will prompt you).
#
# Usage:
#   chmod +x deploy-to-unraid.sh
#   ./deploy-to-unraid.sh
#
set -euo pipefail

UNRAID_HOST="${UNRAID_HOST:-root@192.168.2.15}"
APP_DIR="${APP_DIR:-/mnt/user/appdata/justrentlah-verify}"
REPO="${REPO:-https://github.com/jvlarc/import-configurations.git}"

echo ">> Deploying to ${UNRAID_HOST}:${APP_DIR}"

ssh "${UNRAID_HOST}" bash -s <<EOF
set -euo pipefail

# 1. Clone or update
if [ ! -d "${APP_DIR}/.git" ]; then
  mkdir -p "${APP_DIR}"
  git clone "${REPO}" "${APP_DIR}"
else
  git -C "${APP_DIR}" pull --ff-only
fi
cd "${APP_DIR}/singpass-verify"

# 2. Generate keys if not present
if [ ! -f keys/jwks.json ]; then
  echo ">> Generating Singpass keys (save the printed private values into .env!)"
  docker run --rm -v "\$PWD":/app -w /app node:20-alpine \
    sh -c "npm ci --omit=dev >/dev/null 2>&1 && node scripts/generate-keys.js"
fi

# 3. Ensure .env exists
if [ ! -f .env ]; then
  cp .env.example .env
  echo ""
  echo "!! .env was just created from the template."
  echo "!! Edit ${APP_DIR}/singpass-verify/.env now (App ID, keys, Booqable key,"
  echo "!! admin password, SESSION_SECRET) THEN re-run this script to start."
  exit 0
fi

# 4. Build + start
docker compose up -d --build

echo ""
echo ">> Up. Check on the LAN:"
echo "   curl http://192.168.2.15:3100/health"
echo "   curl http://192.168.2.15:3100/.well-known/jwks.json"
EOF

echo ">> Done. Next: expose https://verify.justrentlah.com via Cloudflare Tunnel (see DEPLOYMENT.md step 5)."
