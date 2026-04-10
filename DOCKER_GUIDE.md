# Docker 部署指南

本项目支持 Docker 容器化部署，可以方便地运行在任何支持 Docker 的环境中。

## 📋 前置要求

- Docker Engine 20.10+
- Docker Compose 2.0+（可选，但推荐）

## 🚀 快速开始

### 使用 Docker Compose（推荐）

```bash
# 1. 克隆项目并进入目录
cd pure-genealogy

# 2. 启动应用
docker-compose up -d

# 3. 访问应用
open http://localhost:3000
```

### 使用纯 Docker

```bash
# 1. 构建镜像
docker build -t genealogy:latest --target production .

# 2. 运行容器
docker run -d \
  --name genealogy \
  -p 3000:3000 \
  -v $(pwd)/data:/app/data \
  -v $(pwd)/backups:/app/backups \
  -e NEXT_PUBLIC_FAMILY_SURNAME="刘" \
  --restart unless-stopped \
  genealogy:latest
```

## 📁 目录结构

```
pure-genealogy/
├── Dockerfile                    # Docker 构建文件
├── docker-compose.yml           # 开发/标准配置
├── docker-compose.prod.yml      # 生产环境配置
├── .dockerignore               # 构建忽略文件
├── data/                       # 数据库目录（自动创建）
│   └── genealogy.db
└── backups/                    # 备份目录（自动创建）
    └── genealogy-backup-*.db
```

## 🔧 配置说明

### 环境变量

| 变量名 | 默认值 | 说明 |
|--------|--------|------|
| `NEXT_PUBLIC_FAMILY_SURNAME` | 刘 | 家族姓氏 |
| `NODE_ENV` | production | 运行环境 |

### 数据持久化

数据通过 Docker 卷持久化：

- `./data` → `/app/data`：SQLite 数据库
- `./backups` → `/app/backups`：备份文件

**重要**：删除容器不会丢失数据，但删除卷会！

## 🎯 常用命令

### 启动/停止

```bash
# 启动（后台运行）
docker-compose up -d

# 停止
docker-compose down

# 停止并删除数据卷（⚠️ 会删除数据）
docker-compose down -v

# 查看日志
docker-compose logs -f

# 重启
docker-compose restart
```

### 备份和恢复

```bash
# 进入容器执行备份
docker-compose exec app npm run db:backup

# 或者直接在宿主机备份
docker exec genealogy-app npm run db:backup

# 恢复备份
docker-compose exec app npm run db:restore
```

### 更新应用

```bash
# 拉取最新代码
git pull

# 重新构建并启动
docker-compose up -d --build
```

## 🌐 生产部署

### 使用生产配置

```bash
# 使用生产优化配置
docker-compose -f docker-compose.prod.yml up -d
```

生产配置特点：
- 使用命名卷（更安全）
- 资源限制（CPU/内存）
- 日志轮转
- 自动重启策略

### 反向代理（Nginx）

创建 `nginx.conf`：

```nginx
server {
    listen 80;
    server_name your-domain.com;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### HTTPS（Let's Encrypt）

使用 `docker-compose` + `nginx-proxy` + `acme-companion`：

```yaml
version: '3.8'

services:
  nginx-proxy:
    image: nginxproxy/nginx-proxy
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - /var/run/docker.sock:/tmp/docker.sock:ro
      - certs:/etc/nginx/certs
      - vhost:/etc/nginx/vhost.d
      - html:/usr/share/nginx/html

  acme-companion:
    image: nginxproxy/acme-companion
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
      - certs:/etc/nginx/certs
      - vhost:/etc/nginx/vhost.d
      - html:/usr/share/nginx/html
      - acme:/etc/acme.sh
    environment:
      - DEFAULT_EMAIL=your-email@example.com

  app:
    build: .
    environment:
      - VIRTUAL_HOST=your-domain.com
      - LETSENCRYPT_HOST=your-domain.com
      - VIRTUAL_PORT=3000
    volumes:
      - genealogy-data:/app/data
      - genealogy-backups:/app/backups

volumes:
  certs:
  vhost:
  html:
  acme:
  genealogy-data:
  genealogy-backups:
```

## 🔒 安全建议

1. **定期备份**
   ```bash
   # 设置定时任务（宿主机）
   crontab -e
   
   # 每天凌晨 3 点备份
   0 3 * * * cd /path/to/pure-genealogy && docker-compose exec -T app npm run db:backup
   ```

2. **限制访问**
   - 使用防火墙限制端口访问
   - 生产环境使用 HTTPS
   - 配置 Nginx 基本认证（可选）

3. **监控日志**
   ```bash
   # 实时查看日志
   docker-compose logs -f --tail=100
   
   # 查看错误日志
   docker-compose logs -f | grep error
   ```

## 🐛 故障排除

### 容器无法启动

```bash
# 查看详细日志
docker-compose logs app

# 检查端口占用
lsof -i :3000

# 使用不同端口
docker-compose up -d -p 3001:3000
```

### 数据库权限错误

```bash
# 修复权限
docker-compose exec app chown -R nextjs:nodejs /app/data

# 或者宿主机执行
sudo chown -R $USER:$USER ./data ./backups
```

### 数据丢失恢复

```bash
# 1. 停止容器
docker-compose down

# 2. 从备份恢复
cp backups/genealogy-backup-XXXX.db data/genealogy.db

# 3. 重启
docker-compose up -d
```

## 📊 性能优化

### 限制资源使用

```yaml
services:
  app:
    deploy:
      resources:
        limits:
          cpus: '1'
          memory: 512M
```

### 使用多阶段构建

Dockerfile 已优化：
- 开发阶段：包含所有依赖，支持热重载
- 构建阶段：编译应用
- 生产阶段：最小镜像，只包含运行所需

## 🔄 自动更新

使用 Watchtower 自动更新容器：

```bash
docker run -d \
  --name watchtower \
  -v /var/run/docker.sock:/var/run/docker.sock \
  containrrr/watchtower \
  --interval 86400 \
  genealogy
```

---

## 💡 提示

- 首次启动会自动创建数据库
- 数据保存在 `./data` 目录，可以复制到其他机器
- 备份文件在 `./backups`，建议定期复制到安全位置
- 使用 `docker-compose -f docker-compose.prod.yml` 获得最佳性能
