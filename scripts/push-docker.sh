#!/bin/bash
# 推送到私有仓库（或 Docker Hub）
# 用法:
#   ./scripts/push-docker.sh <仓库前缀> [版本]
# 示例:
#   ./scripts/push-docker.sh registry.cn-hangzhou.aliyuncs.com/myns           # familybook:latest
#   ./scripts/push-docker.sh harbor.company.local/library/familybook 1.2.0
# 推送前请先: docker login <仓库主机>

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

REGISTRY_PREFIX=${1:?请传入仓库前缀，例如 registry.example.com/namespace}
VERSION=${2:-latest}
IMAGE_NAME=${IMAGE_NAME:-familybook}

FULL_IMAGE="$REGISTRY_PREFIX/$IMAGE_NAME"

echo -e "${GREEN}═══════════════════════════════════════${NC}"
echo -e "${GREEN}      Docker 镜像推送（私有化仓库）${NC}"
echo -e "${GREEN}═══════════════════════════════════════${NC}"
echo ""
echo -e "${YELLOW}目标:${NC} $FULL_IMAGE:$VERSION 与 $FULL_IMAGE:latest"
echo ""

if ! docker image inspect "$IMAGE_NAME:$VERSION" &>/dev/null; then
  echo -e "${RED}本地不存在镜像 $IMAGE_NAME:$VERSION，请先执行:${NC}"
  echo "  ./scripts/build-docker.sh $VERSION"
  exit 1
fi

echo "🏷️  标记..."
docker tag "$IMAGE_NAME:$VERSION" "$FULL_IMAGE:$VERSION"
docker tag "$IMAGE_NAME:$VERSION" "$FULL_IMAGE:latest"

echo "📤 推送..."
docker push "$FULL_IMAGE:$VERSION"
docker push "$FULL_IMAGE:latest"

echo ""
echo -e "${GREEN}✅ 推送完成${NC}"
echo ""
echo "在服务器拉取并运行示例:"
echo "  docker pull $FULL_IMAGE:$VERSION"
echo "  docker run -d -p 3000:3000 -e DATABASE_URL=... -e AUTH_SECRET=... $FULL_IMAGE:$VERSION"
