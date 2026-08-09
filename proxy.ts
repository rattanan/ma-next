import { NextRequest, NextResponse } from "next/server";
const SESSION_COOKIE = "atlas_session";

export default function proxy(request: NextRequest) {
  const hasSession = Boolean(request.cookies.get(SESSION_COOKIE)?.value);
  const path = request.nextUrl.pathname;
  const protectedPrefixes = ["/dashboard", "/assets", "/notifications", "/maintenance", "/work-orders", "/approvals", "/inbox", "/inventory", "/organization", "/settings", "/admin", "/profile"];
  if ((protectedPrefixes.some((prefix) => path === prefix || path.startsWith(`${prefix}/`)) || path === "/change-password") && !hasSession) return NextResponse.redirect(new URL("/login", request.url));
  if (path === "/login" && hasSession) return NextResponse.redirect(new URL("/dashboard", request.url));
  return NextResponse.next();
}
export const config = { matcher: ["/login", "/change-password", "/dashboard/:path*", "/assets/:path*", "/notifications/:path*", "/maintenance/:path*", "/work-orders/:path*", "/approvals/:path*", "/inbox/:path*", "/inventory/:path*", "/profile/:path*", "/admin/:path*", "/organization/:path*", "/settings/:path*"] };
