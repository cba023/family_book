import { NextResponse, type NextRequest } from "next/server";
import { verifySessionTokenOptional } from "@/lib/auth/jwt-edge";
import { SESSION_COOKIE_NAME } from "@/lib/auth/constants";

function authConfigured(): boolean {
  const s = process.env.AUTH_SECRET;
  return Boolean(
    process.env.DATABASE_URL && s && s.length >= 16,
  );
}

function nextWithPathname(request: NextRequest) {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-pathname", request.nextUrl.pathname);
  return NextResponse.next({ request: { headers: requestHeaders } });
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
    "/family-tree/graph-3d",
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
    !path.startsWith("/auth") &&
    !path.startsWith("/setup")
  ) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  return nextWithPathname(request);
}
