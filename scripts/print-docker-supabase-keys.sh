#!/usr/bin/env bash
# 从运行中的 supabase-studio 容器读取 anon / service_role JWT，便于填写 .env.local。
# 用法：./scripts/print-docker-supabase-keys.sh
# 若容器名不同，可设环境变量 STUDIO_CONTAINER=你的容器名

set -euo pipefail
CONTAINER="${STUDIO_CONTAINER:-supabase-studio}"

if ! docker inspect "$CONTAINER" &>/dev/null; then
  echo "找不到容器: $CONTAINER（请先 docker compose up，或设置 STUDIO_CONTAINER）" >&2
  exit 1
fi

echo "--- 复制到 .env.local ---"
docker inspect "$CONTAINER" --format '{{range .Config.Env}}{{println .}}{{end}}' |
  grep -E '^SUPABASE_(ANON_KEY|SERVICE_KEY)=' |
  while IFS= read -r line; do
    key="${line%%=*}"
    val="${line#*=}"
    if [[ "$key" == "SUPABASE_ANON_KEY" ]]; then
      echo "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=$val"
    else
      echo "SUPABASE_SERVICE_ROLE_KEY=$val"
    fi
  done

echo "---（SUPABASE_SERVICE_KEY 即 Next 所需的 SUPABASE_SERVICE_ROLE_KEY）---"
