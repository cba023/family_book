"use client";

/**
 * 登录/注册成功后：先触发 RSC 刷新，再整页 reload。
 * 减轻反向代理或浏览器对 HTML 的缓存导致的「弹窗关了但仍显示未登录」，
 * 并配合中间件下发的 Cache-Control。
 */
export function refreshSessionAfterLogin(router: { refresh: () => void }) {
  router.refresh();
  window.setTimeout(() => {
    window.location.reload();
  }, 0);
}
