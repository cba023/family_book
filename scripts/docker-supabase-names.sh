#!/usr/bin/env bash
# 打印当前机器上 Supabase CLI 栈的容器名（随项目目录变化，例如 supabase_db_family_book）。
# 用法：source scripts/docker-supabase-names.sh   或   eval "$(scripts/docker-supabase-names.sh export)"

detect() {
  SUPABASE_DB_CONTAINER="${SUPABASE_DB_CONTAINER:-$(docker ps --format '{{.Names}}' 2>/dev/null | grep -E '^supabase_db_' | head -n1)}"
  SUPABASE_REST_CONTAINER="${SUPABASE_REST_CONTAINER:-$(docker ps --format '{{.Names}}' 2>/dev/null | grep -E '^supabase_rest_' | head -n1)}"
}

if [[ "${1:-}" == "export" ]]; then
  detect
  echo "export SUPABASE_DB_CONTAINER=${SUPABASE_DB_CONTAINER:-}"
  echo "export SUPABASE_REST_CONTAINER=${SUPABASE_REST_CONTAINER:-}"
  exit 0
fi

detect
echo "SUPABASE_DB_CONTAINER=${SUPABASE_DB_CONTAINER:-<未找到，请先 npx supabase start>}"
echo "SUPABASE_REST_CONTAINER=${SUPABASE_REST_CONTAINER:-<未找到>}"
