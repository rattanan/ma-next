import { NextRequest, NextResponse } from "next/server";
const SESSION_COOKIE = "atlas_session";

export default function proxy(request: NextRequest) {
  const hasSession = Boolean(request.cookies.get(SESSION_COOKIE)?.value);
  const path = request.nextUrl.pathname;
  if ((path.startsWith("/admin") || path.startsWith("/profile") || path.startsWith("/organization") || path.startsWith("/settings") || path.startsWith("/notifications") || path.startsWith("/maintenance") || path === "/change-password") && !hasSession) return NextResponse.redirect(new URL("/login", request.url));
  if (path === "/login" && hasSession) return NextResponse.redirect(new URL("/profile", request.url));
  return NextResponse.next();
}
export const config = { matcher: ["/login", "/change-password", "/profile/:path*", "/admin/:path*", "/organization/:path*", "/settings/:path*", "/notifications/:path*", "/maintenance/:path*"] };
