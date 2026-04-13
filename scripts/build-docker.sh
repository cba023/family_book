#!/bin/bash

# Docker 镜像构建脚本

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}═══════════════════════════════════════${NC}"
echo -e "${GREEN}      族谱应用 Docker 构建工具${NC}"
echo -e "${GREEN}═══════════════════════════════════════${NC}"
echo ""

# 获取版本号
VERSION=${1:-latest}
IMAGE_NAME=${2:-familybook}

echo -e "${YELLOW}构建信息:${NC}"
echo "  镜像名: $IMAGE_NAME"
echo "  版本: $VERSION"
echo "  时间: $(date '+%Y-%m-%d %H:%M:%S')"
echo ""

# 检查 Docker
if ! command -v docker &> /dev/null; then
    echo -e "${RED}错误: Docker 未安装${NC}"
    exit 1
fi

# 检查 Docker Compose
if ! command -v docker-compose &> /dev/null; then
    echo -e "${YELLOW}警告: Docker Compose 未安装${NC}"
fi

echo -e "${YELLOW}开始构建...${NC}"
echo ""

# 构建生产镜像
echo "📦 构建生产镜像..."
docker build \
    --target production \
    -t "$IMAGE_NAME:$VERSION" \
    -t "$IMAGE_NAME:latest" \
    --build-arg BUILD_DATE=$(date -u +'%Y-%m-%dT%H:%M:%SZ') \
    --build-arg VCS_REF=$(git rev-parse --short HEAD 2>/dev/null || echo 'unknown') \
    .

if [ $? -eq 0 ]; then
    echo ""
    echo -e "${GREEN}✅ 构建成功!${NC}"
    echo ""
    echo "镜像信息:"
    docker images "$IMAGE_NAME" --format "  {{.Repository}}:{{.Tag}} | {{.Size}} | {{.CreatedAt}}"
    echo ""
    echo -e "${YELLOW}运行命令:${NC}"
    echo "  docker run -d -p 3000:3000 -v familybook-data:/app/data $IMAGE_NAME:$VERSION"
    echo ""
    echo -e "${YELLOW}或使用 Docker Compose:${NC}"
    echo "  docker-compose up -d"
else
    echo ""
    echo -e "${RED}❌ 构建失败${NC}"
    exit 1
fi
