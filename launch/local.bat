@echo off
cd /d "%~dp0.."
docker version >nul 2>&1
if errorlevel 1 (
  echo Start Docker Desktop and try again.
  pause
  exit /b 1
)
docker run --rm -v "%CD%:/project" -w /project node:24-bookworm-slim node scripts/configure-auth.mjs
if errorlevel 1 (
  pause
  exit /b 1
)
docker build -t ai-agent-local .
if errorlevel 1 (
  pause
  exit /b 1
)
echo Password: data\admin-access.txt. Open local port 3000 on this computer.
docker run --rm -p 127.0.0.1:3000:3000 --env-file .env.local -v ai-agent-local-data:/app/data ai-agent-local
