import { NextResponse, type NextRequest } from 'next/server'

/**
 * 本地模式中间件
 * 不验证登录状态，直接放行
 */
export async function updateSession(request: NextRequest) {
  // 首页重定向到博客页
  if (request.nextUrl.pathname === '/') {
    const url = request.nextUrl.clone()
    url.pathname = '/blog'
    return NextResponse.redirect(url)
  }

  // 本地模式：不需要验证登录，直接放行
  return NextResponse.next({
    request,
  })
}
