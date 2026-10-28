#!/usr/bin/env bash
set -euo pipefail
cd -- "$(dirname -- "$0")/.."
docker version >/dev/null
docker run --rm -v "$PWD:/project" -w /project node:24-bookworm-slim node scripts/configure-auth.mjs
docker build -t ai-agent-local .
printf '\nПароль для входа находится в data/admin-access.txt. Откройте локальный порт 3000 на этом компьютере.\n'
docker run --rm -p 127.0.0.1:3000:3000 --env-file .env.local -v ai-agent-local-data:/app/data ai-agent-local
