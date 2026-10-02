# ─── Stage 1: Build ──────────────────────────────────────────────
FROM node:22-slim AS builder

# Install pnpm
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate

WORKDIR /app

# 1. Copy workspace root files needed by pnpm
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml .npmrc ./

# 2. Copy only the package.json files so Docker can cache `pnpm install`
COPY apps/calling/package.json apps/calling/package.json
COPY packages/typescript-config/package.json packages/typescript-config/package.json

# 3. Install all dependencies (frozen lockfile for reproducibility)
RUN pnpm install --frozen-lockfile

# 4. Copy source code
COPY packages/typescript-config/ packages/typescript-config/
COPY apps/calling/ apps/calling/

# 5. Build the calling service
RUN pnpm --filter @repo/calling run build

# ─── Stage 2: Production ─────────────────────────────────────────
FROM node:22-slim AS runner

RUN corepack enable && corepack prepare pnpm@9.0.0 --activate

WORKDIR /app

# Copy workspace manifests
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml .npmrc ./
COPY apps/calling/package.json apps/calling/package.json
COPY packages/typescript-config/package.json packages/typescript-config/package.json

# Install production dependencies only
RUN pnpm install --frozen-lockfile --prod

# Copy compiled JS from builder stage
COPY --from=builder /app/apps/calling/dist apps/calling/dist
COPY --from=builder /app/packages/typescript-config packages/typescript-config

# Create spool directory for durable call result backups
RUN mkdir -p /app/apps/calling/.call-results

WORKDIR /app/apps/calling

# Fly injects PORT automatically (default 8080)
ENV NODE_ENV=production
EXPOSE 8080

CMD ["node", "dist/index.js"]
