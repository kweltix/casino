FROM node:24-bookworm-slim AS build
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN --mount=type=secret,id=build_ca \
    if [ -f /run/secrets/build_ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/build_ca npm_config_cafile=/run/secrets/build_ca; fi; \
    npm ci --include=dev --cache /tmp/npm-cache
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM node:24-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 HOSTNAME_BIND=0.0.0.0 PORT=3000 DATABASE_PATH=/app/data/agent.sqlite ARTIFACT_DIR=/app/data/artifacts DROP_PRIVILEGES=1
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/.next ./.next
COPY --from=build --chown=node:node /app/src ./src
COPY --from=build --chown=node:node /app/scripts ./scripts
COPY --from=build --chown=node:node /app/package.json /app/package-lock.json /app/tsconfig.json /app/next.config.ts ./
RUN mkdir -p /app/data && chown node:node /app/data
EXPOSE 3000
CMD ["node", "scripts/serve.mjs"]
