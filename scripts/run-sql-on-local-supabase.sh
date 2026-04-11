#!/usr/bin/env bash
# 在本地 Supabase（Docker）的 Postgres 里执行 SQL 文件。
# 容器名形如 supabase_db_<项目名>，不是固定的 supabase-db。
#
# 用法：
#   ./scripts/run-sql-on-local-supabase.sh supabase/migrations/20260412100000_blog_posts_public_read.sql
# 可选环境变量：SUPABASE_DB_CONTAINER=你的容器名

set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SQL_FILE="${1:?请传入 .sql 文件路径，例如 supabase/migrations/xxx.sql}"

if [[ ! -f "$ROOT/$SQL_FILE" ]] && [[ ! -f "$SQL_FILE" ]]; then
  echo "找不到文件: $SQL_FILE" >&2
  exit 1
fi
ABS_SQL="$SQL_FILE"
[[ -f "$ROOT/$SQL_FILE" ]] && ABS_SQL="$ROOT/$SQL_FILE"

DB="${SUPABASE_DB_CONTAINER:-$(docker ps --format '{{.Names}}' 2>/dev/null | grep -E '^supabase_db_' | head -n1)}"
if [[ -z "$DB" ]]; then
  echo "未检测到运行中的 supabase_db_* 容器。" >&2
  echo "请先在本机执行: npx supabase start" >&2
  echo "或设置: export SUPABASE_DB_CONTAINER=你的数据库容器名" >&2
  echo "查看名称: docker ps --format '{{.Names}}' | grep supabase" >&2
  exit 1
fi

echo "使用数据库容器: $DB" >&2
docker exec -i "$DB" psql -U postgres -d postgres < "$ABS_SQL"

REST="${SUPABASE_REST_CONTAINER:-$(docker ps --format '{{.Names}}' 2>/dev/null | grep -E '^supabase_rest_' | head -n1)}"
if [[ -n "$REST" ]]; then
  echo "重启 PostgREST: $REST" >&2
  docker restart "$REST" >/dev/null
  echo "已完成。" >&2
else
  echo "未找到 supabase_rest_*，已跳过 restart（可稍后手动 docker restart <rest容器>）" >&2
fi
