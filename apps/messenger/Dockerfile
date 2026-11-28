# ── Stage 1: Build ──────────────────────────────────────────────────────────
FROM node:24.22.1-slim AS builder

RUN npm install --global pnpm@10.17.1

WORKDIR /app

# 1. Copy workspace root files needed by pnpm
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml .npmrc ./

# 2. Copy package.json manifests
COPY apps/messenger/package.json apps/messenger/package.json
COPY packages/typescript-config/package.json packages/typescript-config/package.json

# 3. Install dependencies
RUN pnpm install --frozen-lockfile

# 4. Copy source code
COPY packages/typescript-config/ packages/typescript-config/
COPY apps/messenger/ apps/messenger/

# 5. Build messenger service
RUN pnpm --filter @repo/messenger run build

# ── Stage 2: Production ─────────────────────────────────────────────────────
FROM node:24.22.1-slim AS runner

RUN npm install --global pnpm@10.17.1

WORKDIR /app

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml .npmrc ./
COPY apps/messenger/package.json apps/messenger/package.json
COPY packages/typescript-config/package.json packages/typescript-config/package.json

RUN pnpm install --frozen-lockfile --prod

COPY --from=builder /app/apps/messenger/dist apps/messenger/dist
COPY --from=builder /app/packages/typescript-config packages/typescript-config

WORKDIR /app/apps/messenger

ENV NODE_ENV=production
EXPOSE 8080

CMD ["node", "dist/index.js"]
