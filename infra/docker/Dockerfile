# Multi-stage build for the three application images. Select one with
# `--target api|web|worker`; they share the install and build stages so a deploy compiles
# the workspace once.
#
#   docker build -f infra/docker/Dockerfile --target api -t church-api .
#
# Node 24 (see .nvmrc). Debian slim rather than Alpine: Prisma's engines and @node-rs/argon2
# ship glibc binaries.

# ---------------------------------------------------------------------------
# Dependencies: install once for the whole workspace, cached on the lockfile.
# ---------------------------------------------------------------------------
FROM node:24-slim AS deps
ENV PNPM_HOME=/pnpm
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable
WORKDIR /repo

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY apps/worker/package.json apps/worker/
COPY packages/api-client/package.json packages/api-client/
COPY packages/config/package.json packages/config/
COPY packages/database/package.json packages/database/
COPY packages/infrastructure/package.json packages/infrastructure/
COPY packages/shared/package.json packages/shared/
COPY packages/ui/package.json packages/ui/
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile

# ---------------------------------------------------------------------------
# Build: generate the Prisma client, then compile packages and applications.
# `next build` needs no running API (pages call connection() before fetching).
# ---------------------------------------------------------------------------
FROM deps AS build
WORKDIR /repo
COPY . .
RUN pnpm db:generate && pnpm build:packages && pnpm --filter @church/api --filter @church/worker --filter @church/web build

# ---------------------------------------------------------------------------
# Runtime base: production dependencies only, unprivileged user.
# ---------------------------------------------------------------------------
FROM node:24-slim AS runtime
ENV NODE_ENV=production
ENV PNPM_HOME=/pnpm
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && apt-get update \
  && apt-get install -y --no-install-recommends curl \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /repo
COPY --from=build /repo/package.json /repo/pnpm-lock.yaml /repo/pnpm-workspace.yaml /repo/.npmrc ./
COPY --from=build /repo/apps/api/package.json apps/api/
COPY --from=build /repo/apps/worker/package.json apps/worker/
COPY --from=build /repo/packages/api-client/package.json packages/api-client/
COPY --from=build /repo/packages/config/package.json packages/config/
COPY --from=build /repo/packages/database/package.json packages/database/
COPY --from=build /repo/packages/infrastructure/package.json packages/infrastructure/
COPY --from=build /repo/packages/shared/package.json packages/shared/
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
  pnpm install --frozen-lockfile --prod --filter @church/api --filter @church/worker --filter '@church/api-client' --filter '@church/database' --filter '@church/infrastructure' --filter '@church/shared'
COPY --from=build /repo/packages/shared/dist packages/shared/dist
COPY --from=build /repo/packages/infrastructure/dist packages/infrastructure/dist
COPY --from=build /repo/packages/api-client/dist packages/api-client/dist
COPY --from=build /repo/packages/database/dist packages/database/dist
COPY --from=build /repo/packages/database/src/generated packages/database/src/generated

# ---------------------------------------------------------------------------
# API
# ---------------------------------------------------------------------------
FROM runtime AS api
COPY --from=build /repo/apps/api/dist apps/api/dist
WORKDIR /repo/apps/api
USER node
EXPOSE 4000
HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=5 \
  CMD curl -fsS http://127.0.0.1:4000/api/health/ready || exit 1
CMD ["node", "dist/main.js"]

# ---------------------------------------------------------------------------
# Worker: no HTTP server, so liveness is the process itself.
# ---------------------------------------------------------------------------
FROM runtime AS worker
COPY --from=build /repo/apps/worker/dist apps/worker/dist
WORKDIR /repo/apps/worker
USER node
CMD ["node", "dist/main.js"]

# ---------------------------------------------------------------------------
# Migrations: a one-shot container that runs `prisma migrate deploy` (never `dev`
# or `reset`, see AGENTS.md §12) before the applications start.
# ---------------------------------------------------------------------------
FROM build AS migrate
WORKDIR /repo/packages/database
CMD ["pnpm", "exec", "prisma", "migrate", "deploy"]

# ---------------------------------------------------------------------------
# Web: Next.js standalone output carries its own minimal node_modules.
# ---------------------------------------------------------------------------
FROM node:24-slim AS web
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
RUN apt-get update && apt-get install -y --no-install-recommends curl \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=build /repo/apps/web/.next/standalone ./
COPY --from=build /repo/apps/web/.next/static ./apps/web/.next/static
# No apps/web/public: fonts are bundled and every other asset is generated (icons,
# sitemap, robots) by route handlers. Add a COPY here if one is ever introduced.
USER node
EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=5 \
  CMD curl -fsS http://127.0.0.1:3000/ -o /dev/null || exit 1
CMD ["node", "apps/web/server.js"]
