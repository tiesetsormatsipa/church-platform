# apps/web/Dockerfile
FROM node:20-alpine AS builder
WORKDIR /app

COPY package.json yarn.lock* ./
COPY apps/web/package.json ./apps/web/
COPY packages/shared/package.json ./packages/shared/
RUN yarn install --frozen-lockfile

COPY apps/web/ ./apps/web/
COPY packages/shared/ ./packages/shared/

WORKDIR /app/apps/web
ENV NEXT_TELEMETRY_DISABLED=1
RUN yarn build

# Production image
FROM node:20-alpine AS production
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder /app/apps/web/public ./apps/web/public

EXPOSE 3000

CMD ["node", "apps/web/server.js"]
