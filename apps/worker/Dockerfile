# ─── Stage 1: Build ──────────────────────────────────────────────
FROM node:24.22.1-slim AS builder

RUN npm install --global pnpm@10.17.1

WORKDIR /app

# 1. Copy workspace root files
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./

# 2. Copy package.json manifests for caching
COPY apps/worker/package.json apps/worker/package.json
COPY packages/typescript-config/package.json packages/typescript-config/package.json

# 3. Install all dependencies
RUN pnpm install --frozen-lockfile

# 4. Copy source code
COPY packages/typescript-config/ packages/typescript-config/
COPY apps/worker/ apps/worker/

# 5. Build worker service
RUN pnpm --filter @repo/worker run build

# ─── Stage 2: Production ─────────────────────────────────────────
FROM node:24.22.1-slim AS runner

RUN npm install --global pnpm@10.17.1

WORKDIR /app

# Copy workspace manifests
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/worker/package.json apps/worker/package.json
COPY packages/typescript-config/package.json packages/typescript-config/package.json

# Install production dependencies only
RUN pnpm install --frozen-lockfile --prod

# Copy compiled JS from builder stage
COPY --from=builder /app/packages/typescript-config packages/typescript-config
COPY --from=builder /app/apps/worker/dist apps/worker/dist

WORKDIR /app/apps/worker

ENV NODE_ENV=production
EXPOSE 5050

CMD ["node", "dist/index.js"]
