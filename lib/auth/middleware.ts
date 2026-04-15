import { NextResponse, type NextRequest } from "next/server";
import { verifySessionTokenOptional } from "@/lib/auth/jwt-edge";
import { SESSION_COOKIE_NAME } from "@/lib/auth/constants";

function authConfigured(): boolean {
  const s = process.env.AUTH_SECRET;
  return Boolean(
    process.env.DATABASE_URL && s && s.length >= 16,
  );
}

/**
 * 避免公网 CDN / 浏览器缓存「未登录」时的 HTML，导致登录后 reload 仍显示未登录。
 */
function applyPrivateNoStore(request: NextRequest, res: NextResponse) {
  if (request.method !== "GET") return res;
  const path = request.nextUrl.pathname;
  if (path.startsWith("/_next") || path.startsWith("/api")) return res;
  res.headers.set(
    "Cache-Control",
    "private, no-store, must-revalidate",
  );
  return res;
}

function nextWithPathname(request: NextRequest) {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-pathname", request.nextUrl.pathname);
  const res = NextResponse.next({ request: { headers: requestHeaders } });
  return applyPrivateNoStore(request, res);
}

export async function updateSession(request: NextRequest) {
  if (!authConfigured()) {
    return nextWithPathname(request);
  }

  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const user = await verifySessionTokenOptional(token);

  const publicPaths = [
    "/",
    "/blog",
    "/family-tree/graph",
    "/family-tree/statistics",
    "/family-tree/biography-book",
    "/family-tree/timeline",
  ];
  const path = request.nextUrl.pathname;
  const isPublicPath =
    publicPaths.some(
      (p) => path === p || (p !== "/" && path.startsWith(p)),
    ) ||
    path.startsWith("/blog/") ||
    path.startsWith("/family-tree/graph");

  if (
    !isPublicPath &&
    !user &&
    !path.startsWith("/noauth") &&
    !path.startsWith("/auth")
  ) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    const redirectRes = NextResponse.redirect(url);
    return applyPrivateNoStore(request, redirectRes);
  }

  return nextWithPathname(request);
}
