# 使用 Node.js 20 作为基础镜像
FROM node:20-alpine AS base

# 安装必要的系统依赖（用于 better-sqlite3 编译）
RUN apk add --no-cache python3 make g++ gcc libc-dev

# 设置工作目录
WORKDIR /app

# 复制 package.json 和 package-lock.json
COPY package*.json ./

# 安装依赖
RUN npm ci --only=production

# 重新编译 better-sqlite3（Alpine 需要）
RUN npm rebuild better-sqlite3

# 开发阶段
FROM base AS dev

# 安装所有依赖（包括 devDependencies）
RUN npm ci

# 重新编译 better-sqlite3
RUN npm rebuild better-sqlite3

# 复制源代码
COPY . .

# 创建数据目录
RUN mkdir -p data backups

# 暴露端口
EXPOSE 3000

# 启动开发服务器
CMD ["npm", "run", "dev"]

# 构建阶段
FROM base AS builder

# 安装所有依赖
RUN npm ci

# 重新编译 better-sqlite3
RUN npm rebuild better-sqlite3

# 复制源代码
COPY . .

# Next.js 在构建时内联 NEXT_PUBLIC_*；未设置时使用本地 Supabase CLI 默认 demo anon key（部署生产请用 build-arg 覆盖）
ARG NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
ARG NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0
ARG NEXT_PUBLIC_FAMILY_SURNAME=陈
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=$NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
ENV NEXT_PUBLIC_FAMILY_SURNAME=$NEXT_PUBLIC_FAMILY_SURNAME

# 构建应用
RUN npm run build

# 生产阶段
FROM node:20-alpine AS production

# 安装必要的运行时依赖
RUN apk add --no-cache dumb-init

# 设置工作目录
WORKDIR /app

# 设置为生产环境
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# 复制 package.json
COPY package*.json ./

# 只安装生产依赖
RUN npm ci --only=production && npm cache clean --force

# 重新编译 better-sqlite3
RUN npm rebuild better-sqlite3

# 复制构建产物
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/lib ./lib

# 创建数据目录（用于挂载卷）
RUN mkdir -p data backups

# 使用非 root 用户运行（安全最佳实践）
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs
RUN chown -R nextjs:nodejs /app/data /app/backups
USER nextjs

# 暴露端口
EXPOSE 3000

# 健康检查
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/api/health', (r) => r.statusCode === 200 ? process.exit(0) : process.exit(1))"

# 启动应用
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "server.js"]
