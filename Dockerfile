# 使用 Node.js 20 作为基础镜像
FROM node:20-alpine AS base

WORKDIR /app

COPY package*.json ./

# 生产依赖
FROM base AS prod_deps
RUN npm ci --omit=dev

# 开发：全量依赖
FROM base AS dev
RUN npm ci
COPY . .
RUN mkdir -p backups
EXPOSE 3000
CMD ["npm", "run", "dev"]

# 构建
FROM base AS builder
RUN npm ci
COPY . .

ARG NEXT_PUBLIC_FAMILY_SURNAME=陈
ENV NEXT_PUBLIC_FAMILY_SURNAME=$NEXT_PUBLIC_FAMILY_SURNAME
ENV SKIP_SETUP_GATE=1

RUN npm run build

# 生产运行（Next.js standalone）
FROM node:20-alpine AS production

RUN apk add --no-cache dumb-init

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder /app/docker/postgres/init.sql ./docker/postgres/init.sql
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# /app 本身多为 root 属主，需在切换用户前创建可写目录
RUN mkdir -p backups data && chown -R nextjs:nodejs backups data

USER nextjs

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000', (r) => r.statusCode === 200 ? process.exit(0) : process.exit(1))"

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "server.js"]
