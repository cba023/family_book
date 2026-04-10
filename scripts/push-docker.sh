#!/bin/bash

# Docker 镜像推送脚本
# 用于推送到 Docker Hub 或其他仓库

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

REGISTRY=${1:-""}  # 例如: docker.io/username
IMAGE_NAME=${2:-genealogy}
VERSION=${3:-latest}

if [ -n "$REGISTRY" ]; then
    FULL_IMAGE_NAME="$REGISTRY/$IMAGE_NAME"
else
    FULL_IMAGE_NAME="$IMAGE_NAME"
fi

echo -e "${GREEN}═══════════════════════════════════════${NC}"
echo -e "${GREEN}      Docker 镜像推送工具${NC}"
echo -e "${GREEN}═══════════════════════════════════════${NC}"
echo ""
echo -e "${YELLOW}推送信息:${NC}"
echo "  仓库: ${REGISTRY:-'(默认)'})"
echo "  镜像: $FULL_IMAGE_NAME"
echo "  版本: $VERSION"
echo ""

# 检查是否登录
if ! docker info | grep -q "Username"; then
    echo -e "${YELLOW}请先登录 Docker Hub:${NC}"
    echo "  docker login"
    exit 1
fi

# 标记镜像
echo "🏷️  标记镜像..."
docker tag "$IMAGE_NAME:$VERSION" "$FULL_IMAGE_NAME:$VERSION"
docker tag "$IMAGE_NAME:$VERSION" "$FULL_IMAGE_NAME:latest"

# 推送镜像
echo "📤 推送镜像..."
docker push "$FULL_IMAGE_NAME:$VERSION"
docker push "$FULL_IMAGE_NAME:latest"

echo ""
echo -e "${GREEN}✅ 推送成功!${NC}"
echo ""
echo "拉取命令:"
echo "  docker pull $FULL_IMAGE_NAME:$VERSION"
