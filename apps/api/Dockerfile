# apps/api/Dockerfile
FROM node:20-alpine AS builder
WORKDIR /app

# Install dependencies
COPY package.json yarn.lock* ./
COPY apps/api/package.json ./apps/api/
COPY packages/shared/package.json ./packages/shared/
RUN yarn install --frozen-lockfile

# Copy source and build
COPY apps/api/ ./apps/api/
COPY packages/shared/ ./packages/shared/
WORKDIR /app/apps/api
RUN yarn db:generate
RUN yarn build

# Production image
FROM node:20-alpine AS production
WORKDIR /app

ENV NODE_ENV=production

COPY --from=builder /app/apps/api/dist ./dist
COPY --from=builder /app/apps/api/package.json ./
COPY --from=builder /app/apps/api/prisma ./prisma
COPY --from=builder /app/node_modules ./node_modules

# Create logs directory
RUN mkdir -p logs

EXPOSE 4000

CMD ["node", "dist/main"]
