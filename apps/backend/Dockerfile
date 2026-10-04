# ─── Stage 1: Build ──────────────────────────────────────────────
FROM node:22-slim AS builder

RUN corepack enable && corepack prepare pnpm@9.0.0 --activate

WORKDIR /app

# 1. Copy workspace root files
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./

# 2. Copy package.json manifests for caching
COPY apps/backend/package.json apps/backend/package.json
COPY packages/db/package.json packages/db/package.json
COPY packages/typescript-config/package.json packages/typescript-config/package.json

# 3. Install all dependencies
RUN pnpm install --frozen-lockfile

# 4. Copy source code
COPY packages/typescript-config/ packages/typescript-config/
COPY packages/db/ packages/db/
COPY apps/backend/ apps/backend/

# 5. Build packages and backend service
RUN pnpm --filter @repo/db run build
RUN pnpm --filter @repo/backend run build

# ─── Stage 2: Production ─────────────────────────────────────────
FROM node:22-slim AS runner

RUN corepack enable && corepack prepare pnpm@9.0.0 --activate

WORKDIR /app

# Copy workspace manifests
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/backend/package.json apps/backend/package.json
COPY packages/db/package.json packages/db/package.json
COPY packages/typescript-config/package.json packages/typescript-config/package.json

# Install production dependencies only
RUN pnpm install --frozen-lockfile --prod

# Copy compiled JS from builder stage
COPY --from=builder /app/packages/db packages/db
COPY --from=builder /app/packages/typescript-config packages/typescript-config
COPY --from=builder /app/apps/backend/dist apps/backend/dist

WORKDIR /app/apps/backend

ENV NODE_ENV=production
EXPOSE 4000

CMD ["node", "dist/index.js"]
