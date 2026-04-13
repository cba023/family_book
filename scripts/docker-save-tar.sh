#!/bin/bash
# 将本地镜像打成 tar 包，可拷贝到无公网机器后执行: docker load -i xxx.tar
# 用法:
#   ./scripts/docker-save-tar.sh [输出路径]
# 默认: ./dist/familybook-latest.tar

set -e

IMAGE_NAME="${IMAGE_NAME:-familybook}"
TAG="${TAG:-latest}"
OUT="${1:-dist/${IMAGE_NAME}-${TAG}.tar}"

mkdir -p "$(dirname "$OUT")"

if ! docker image inspect "${IMAGE_NAME}:${TAG}" &>/dev/null; then
  echo "本地没有镜像 ${IMAGE_NAME}:${TAG}，请先执行: npm run docker:build"
  exit 1
fi

echo "导出 ${IMAGE_NAME}:${TAG} -> $OUT"
docker save "${IMAGE_NAME}:${TAG}" -o "$OUT"
ls -lh "$OUT"
echo ""
echo "在目标机导入:"
echo "  docker load -i $(basename "$OUT")"
echo "然后运行（需自备 Postgres 与环境变量）:"
echo "  docker run -d -p 3000:3000 -v familybook-data:/app/data \\"
echo "    -e DATABASE_URL=... -e AUTH_SECRET=... ${IMAGE_NAME}:${TAG}"
