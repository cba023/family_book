// 本地模式 - 不使用 Supabase

// 模拟用户
const MOCK_USER = {
  id: "local-user",
  email: "admin@local.com",
};

/**
 * 本地模式下的模拟客户端
 */
export function createClient() {
  return {
    auth: {
      getUser: async () => ({ data: { user: MOCK_USER }, error: null }),
      signOut: async () => ({ error: null }),
    },
  };
}
