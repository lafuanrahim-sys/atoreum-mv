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
 * Also enforces site-wide maintenance mode (Dashboard -> Settings). This
 * has to live here rather than in app/layout.tsx: a shared layout like the
 * root one only re-executes its Server Component body on a fresh page
 * load, not on every subsequent client-side <Link> navigation (Next.js
 * keeps it mounted across route changes within the same layout scope) — an
 * earlier version gated in the layout instead, which meant loading the
 * exempt /login page once and then clicking any nav link silently skipped
 * the check for every page after that. Middleware runs on every request,
 * including the RSC fetch a client-side navigation makes, so it can't be
 * bypassed that way.
 */

const MAINTENANCE_EXEMPT_PREFIXES = ["/login", "/dashboard", "/maintenance"];

// Maintenance mode lives in Postgres (store_settings), but this file runs
// on the Edge runtime (see lib/auth/userSession.ts's own comment: no Node
// `crypto`/`fs`, so no raw `pg` connection either) — fetched from a small
// Node-runtime Route Handler instead, and cached in-memory per Edge
// instance for a few seconds so this doesn't add a network hop to every
// single request. Same eventual-consistency tradeoff already documented on
// the settings page: a toggle can take a few seconds to take effect.
let cachedMaintenanceMode = false;
let cacheExpiresAt = 0;

async function getMaintenanceMode(origin: string): Promise<boolean> {
  const now = Date.now();
  if (now < cacheExpiresAt) return cachedMaintenanceMode;
  try {
    const res = await fetch(new URL("/api/internal/maintenance-status", origin), {
      // Edge fetch cache, distinct from the in-memory one above — belt and
      // suspenders against a stampede if many requests land at once right
      // as the in-memory cache expires.
      next: { revalidate: 5 },
    });
    const data = (await res.json()) as { maintenanceMode: boolean };
    cachedMaintenanceMode = data.maintenanceMode;
  } catch {
    // Fail open on the check itself failing (e.g. the DB is briefly
    // unreachable) -- a broken maintenance check shouldn't take the whole
    // site down on top of whatever's already wrong.
    cachedMaintenanceMode = false;
  }
  cacheExpiresAt = now + 5_000;
  return cachedMaintenanceMode;
}

const CANONICAL_HOST = "atoreum.mv";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // The site only exists at atoreum.mv now — the *.vercel.app fallback
  // (both the stable project alias, atoreum-mv.vercel.app, and every
  // individual deployment's own preview URL) redirects to the real domain
  // instead of serving content directly. www.atoreum.mv and localhost are
  // untouched.
  const host = request.headers.get("host") ?? "";
  if (host.endsWith(".vercel.app")) {
    return NextResponse.redirect(
      new URL(`${pathname}${request.nextUrl.search}`, `https://${CANONICAL_HOST}`),
      308
    );
  }

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

  const exempt = MAINTENANCE_EXEMPT_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  if (!exempt && !isAdminRole(session?.role) && (await getMaintenanceMode(request.nextUrl.origin))) {
    // Redirect, not rewrite. A rewrite quietly serves /maintenance's route
    // tree while the client-side router still believes it's on whatever
    // page was actually requested -- fine for a full page load (curl, or a
    // fresh visit), but a client-side <Link> navigation sends the router an
    // RSC payload shaped for a route it didn't ask for, which it can't
    // reconcile: confirmed in testing as a stale header with blank content
    // underneath. A real redirect lands the client on /maintenance for
    // real, so the payload always matches what the router expects.
    return NextResponse.redirect(new URL("/maintenance", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Everything except API routes, Next's own internals, and static
    // assets (identified by a file extension).
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|woff2?|ttf|map)$).*)",
  ],
};
