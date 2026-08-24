# -------------------------
# Stage 1 - Build
# -------------------------
FROM node:22-alpine AS builder

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@10.26.1 --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY tsconfig*.json ./

COPY packages ./packages
COPY lib ./lib
COPY artifacts ./artifacts

RUN pnpm config set onlyBuiltDependencies "@swc/core,esbuild,msw,unrs-resolver"
RUN pnpm install --frozen-lockfile

RUN pnpm --filter @workspace/api-server build

# -------------------------
# Stage 2 - Runtime
# -------------------------
FROM node:22-alpine

RUN apk add --no-cache \
  poppler-utils \
  tesseract-ocr \
  tesseract-ocr-data-eng

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@10.26.1 --activate

ENV NODE_ENV=production

COPY --from=builder /app /app

EXPOSE 10000

RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser

WORKDIR /app/artifacts/api-server

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget --spider -q http://localhost:10000/ || exit 1

CMD ["node", "--enable-source-maps", "./dist/index.mjs"]