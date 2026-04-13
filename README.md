# pure-genealogy 族谱管理系统

<p align="center">
  <img alt="pure-genealogy Tree" src="app/demo.gif" width="800">
</p>

<p align="center">
  基于 Next.js（App Router）与 PostgreSQL 的全中文家族族谱与博客应用，支持 Docker 部署与首次启动向导。
</p>

## ✨ 项目亮点

- **前沿技术栈**: **Next.js** (App Router)、**React 19**、TypeScript。
- **数据与认证**: **PostgreSQL** 持久化；自建会话（JWT Cookie + bcrypt），无第三方 BaaS 绑定。
- **首次启动向导**: 浏览器内配置数据库连接、执行建表脚本、创建超级管理员（`/setup`）。
- **深度中文化**: UI、日期与统计针对中文语境优化。
- **多维可视化**:
  - **2D 族谱图**: 世代标尺、代际配色、配偶展示、溯源/繁衍高亮、大图导出。
  - **3D 关系网**: 力导向图与自动巡游。
  - **家族统计**: 世代、性别、在世比例等。
  - **历史时间轴**: 生卒年分布。
- **沉浸式体验**:
  - **传记书模式**: 3D 翻书/画卷式详情与 Slate 富文本生平编辑。

## 🛠️ 技术栈

- **框架**: [Next.js](https://nextjs.org/) (App Router, Server Actions)
- **数据库**: [PostgreSQL](https://www.postgresql.org/)（`pg` 驱动）
- **UI**: [shadcn/ui](https://ui.shadcn.com/)（Radix UI）、[Tailwind CSS](https://tailwindcss.com/)
- **可视化**: [@xyflow/react](https://reactflow.dev/)、[react-force-graph-3d](https://github.com/vasturiano/react-force-graph-3d)、[recharts](https://recharts.org/)
- **富文本**: [Slate.js](https://docs.slatejs.org/)
- **容器**: Docker / Docker Compose

## 🚀 主要功能

### 1. 核心管理 (`/family-tree`)

成员档案、富文本生平、批量导入导出、权限（超级管理员 / 管理员 / 用户）。

### 2. 可视化视图

2D 族谱图、3D 关系网、统计仪表盘、时间轴、传记书模式等。

### 3. 博客 (`/blog`)

文章发布与浏览（含 hash 链接）。

### 4. 认证与系统

注册登录、站内用户管理；中间件在配置好环境变量后保护部分路由。

---

## 📦 本地开发

### 1. 克隆与安装

```bash
git clone <你的仓库地址>
cd family_book
npm install
```

### 2. 准备 PostgreSQL

任选其一：

- 本机或 Docker 运行 PostgreSQL（示例：`docker run` / 项目自带 `docker-compose.yml` 中的 `postgres` 服务）。
- 记下连接串，形如：`postgresql://用户:密码@主机:5432/数据库名`。

### 3. 环境变量（可选）

复制 `.env.example` 为 `.env.local`。也可先不填：启动后通过 **`/setup`** 向导写入连接信息（并会合并进 `.env.local`）。

| 变量 | 说明 |
|------|------|
| `DATABASE_URL` | PostgreSQL 连接串 |
| `AUTH_SECRET` | 至少 16 字符，用于签发登录 Cookie |
| `NEXT_PUBLIC_FAMILY_SURNAME` | 站点展示的姓氏，默认「陈」 |

### 4. 数据库表结构

- 推荐：浏览器打开应用后走 **`/setup`**，在向导中执行 **`docker/postgres/init.sql`**。
- 或手动：`psql $DATABASE_URL -f docker/postgres/init.sql`

### 5. 启动

```bash
npm run dev
```

访问 [http://localhost:3000](http://localhost:3000)。未完成初始化时会进入 **`/setup`**。

---

## 🐳 部署说明（Docker）

应用与数据库**分开展示**：镜像内为 Next.js 生产构建（standalone），PostgreSQL 使用官方镜像或外部托管库。

### 方式一：Docker Compose（推荐）

项目根目录已提供编排：

**开发/单机常用：`docker-compose.yml`**

```bash
# 必填：会话密钥（生产请用强随机串）
export AUTH_SECRET='请替换为至少16位随机字符串'

docker compose up -d --build
```

- **应用**: [http://localhost:3000](http://localhost:3000)
- **Postgres**: 默认用户/库 `genealogy`，密码 `genealogy`，端口 `5432`（可通过环境变量覆盖，见 compose 文件）。
- 首次访问按向导完成 **`/setup`**（若库已初始化且已有用户，将直接进入站点）。

**生产参考：`docker-compose.prod.yml`**

```bash
export AUTH_SECRET='你的强随机密钥'
docker compose -f docker-compose.prod.yml up -d --build
```

与默认 compose 类似，附带资源限制、日志轮转等示例，可按机器调整。

### 方式二：仅构建应用镜像

```bash
npm run docker:build
# 或: ./scripts/build-docker.sh
# 或: docker build -t familybook:latest --target production .
```

**导出为本地 tar 包**（U 盘 / 内网离线机）：

```bash
npm run docker:build
npm run docker:save
# 生成 dist/familybook-latest.tar；自定义路径: ./scripts/docker-save-tar.sh /path/out.tar
```

目标机：`docker load -i familybook-latest.tar`，再 `docker run` 或 compose（需自备数据库与 `AUTH_SECRET` 等）。

**推送到私有仓库**（阿里云 ACR、Harbor、自建 Registry 等）前先 `docker login`，再：

```bash
./scripts/push-docker.sh <仓库前缀>
# 例如: ./scripts/push-docker.sh registry.cn-hangzhou.aliyuncs.com/你的命名空间
# 将推送: <前缀>/familybook:latest 与指定版本
```

服务器上设置 `FAMILYBOOK_IMAGE=<前缀>/familybook:latest` 后，可在 compose 里把 `app.image` 改为该变量并去掉 `build` 段，或 `docker pull` 后 `docker run`。

运行时需自行提供 PostgreSQL，并注入环境变量，例如：

```bash
docker run -d --name familybook-app -p 3000:3000 \
  -v familybook-data:/app/data \
  -e DATABASE_URL='postgresql://用户:密码@数据库主机:5432/库名' \
  -e AUTH_SECRET='至少16位随机串' \
  -e NEXT_PUBLIC_FAMILY_SURNAME='陈' \
  familybook:latest
```

`DATABASE_URL` 中的主机名在容器网络内应指向可解析的 Postgres 服务（例如同一 compose 中的服务名 `postgres`）。

### 持久化与数据目录

| 内容 | 说明 |
|------|------|
| Postgres 数据卷 | Compose 中 `postgres_data` / `genealogy-pg-data` 等，勿删以免丢库 |
| `backups/` | 可选挂载，配合 `npm run db:backup`（需宿主机有 `pg_dump`） |
| `/app/data`（容器内） | 向导写入 `runtime-config.json`；Compose 已用命名卷 **`familybook-data`** / **`familybook-app-data`** 持久化 |

### 构建说明

- 生产镜像使用 **Next.js standalone** 输出，入口为 `node server.js`。
- 构建阶段设置 `SKIP_SETUP_GATE=1`，避免 CI/无库环境下 `next build` 被安装向导逻辑阻塞。
- 镜像内包含 **`docker/postgres/init.sql`**，供向导在容器内执行建表。

### 安全建议

- **切勿**将 `AUTH_SECRET`、数据库密码提交到仓库；生产使用密钥管理或编排注入。
- 向导完成后若提示重启：修改 `.env` 或编排环境变量后，**重启应用容器**可使中间件与进程内环境一致。

---

## 📂 项目结构（节选）

```
├── app/                    # App Router：族谱、博客、认证、/setup 向导
├── components/
├── docker/postgres/        # 初始化 SQL（init.sql）
├── lib/                    # pg、认证、运行时配置等
├── proxy.ts                # Next 中间件入口
├── Dockerfile
├── docker-compose.yml
└── docker-compose.prod.yml
```

## 📄 许可证

本项目采用 [MIT](LICENSE) 许可证。
