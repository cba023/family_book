import { NextResponse, type NextRequest } from "next/server";
import { verifySessionTokenOptional } from "@/lib/auth/jwt";
import { SESSION_COOKIE_NAME } from "@/lib/auth/constants";

function authConfigured(): boolean {
  const s = process.env.AUTH_SECRET;
  return Boolean(
    process.env.DATABASE_URL && s && s.length >= 16,
  );
}

export async function updateSession(request: NextRequest) {
  if (!authConfigured()) {
    return NextResponse.next({ request });
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
    !path.startsWith("/auth")
  ) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  return NextResponse.next({ request });
}
