// 本地模式 - 不使用 Supabase
import { cookies } from "next/headers";

// 模拟用户会话（本地模式使用固定用户）
const MOCK_USER = {
  id: "local-user",
  email: "admin@local.com",
};

/**
 * 本地模式下的模拟客户端
 * 不连接 Supabase，直接返回模拟数据
 */
export async function createClient() {
  // 返回模拟的 supabase 客户端
  return {
    auth: {
      getClaims: async () => ({ data: { claims: MOCK_USER }, error: null }),
      getUser: async () => ({ data: { user: MOCK_USER }, error: null }),
      signOut: async () => ({ error: null }),
    },
  };
}

// 检查是否配置了 Supabase 环境变量
export function hasEnvVars(): boolean {
  return false; // 本地模式返回 false
}
