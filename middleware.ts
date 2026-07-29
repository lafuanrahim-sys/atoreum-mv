import { NextResponse, type NextRequest } from "next/server";
import { USER_SESSION_COOKIE, isAdminRole, verifyUserSessionToken } from "@/lib/auth/userSession";

/**
 * Route protection for the unified account system:
 * - /account/*   any signed-in user (customer or admin)
 * - /dashboard/* admins only
 * - /admin/*     retired — permanently redirected to the new locations, so
 *   old bookmarks keep working but no separate admin URL exists anymore.
 * See lib/auth/userSession.ts for the caveats on this auth approach.
 *
 * Also forwards the current pathname as a request header on every
 * page request (not just the three prefixes above) — app/layout.tsx reads
 * it to decide whether to gate a route behind maintenance mode, since a
 * Server Component layout has no other way to know the request path.
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

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-pathname", pathname);
  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  matcher: [
    // Everything except API routes, Next's own internals, and static
    // assets (identified by a file extension) -- those don't render
    // through app/layout.tsx, so they have no need for the pathname
    // header and no reason to pay this middleware's cost.
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|woff2?|ttf|map)$).*)",
  ],
};
