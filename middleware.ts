import { NextResponse, type NextRequest } from "next/server";
import { USER_SESSION_COOKIE, isAdminRole, verifyUserSessionToken } from "@/lib/auth/userSession";

/**
 * Route protection for the unified account system:
 * - /account/*   any signed-in user (customer or admin)
 * - /dashboard/* admins only
 * - /admin/*     retired — permanently redirected to the new locations, so
 *   old bookmarks keep working but no separate admin URL exists anymore.
 * See lib/auth/userSession.ts for the caveats on this auth approach.
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname === "/admin/login" || pathname === "/admin") {
    return NextResponse.redirect(
      new URL(pathname === "/admin" ? "/dashboard" : "/login", request.url)
    );
  }
  if (pathname.startsWith("/admin/")) {
    return NextResponse.redirect(
      new URL(pathname.replace(/^\/admin/, "/dashboard"), request.url)
    );
  }

  const session = await verifyUserSessionToken(
    request.cookies.get(USER_SESSION_COOKIE)?.value
  );

  if (pathname.startsWith("/dashboard")) {
    if (!session || !isAdminRole(session.role)) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("from", pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  if (pathname.startsWith("/account")) {
    if (!session) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("from", pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/admin/:path*",
    "/admin",
    "/dashboard/:path*",
    "/dashboard",
    "/account/:path*",
    "/account",
  ],
};
