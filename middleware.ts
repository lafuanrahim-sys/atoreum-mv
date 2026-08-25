import { NextResponse, type NextFetchEvent, type NextRequest } from "next/server";
import { USER_SESSION_COOKIE, isAdminRole, verifyUserSessionToken } from "@/lib/auth/userSession";

/**
 * Route protection for the unified account system:
 * - /account/*   any signed-in user (customer or admin)
 * - /dashboard/* admins only
 * - /fx/*        admins only — the Dollar Exchange portal, a separate
 *   top-level route (its own shell, see components/fx/FxPortalShell.tsx)
 *   rather than a page nested under /dashboard.
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

// /robots.txt and /sitemap.xml are exempt because search engines must be able
// to read them even while the storefront is closed. Neither is excluded by the
// matcher below (it only skips paths ending in an image/asset extension), so
// without this a maintenance window would 307 every crawler request for them
// to a page that answers 200 -- and Search Console reports that as a sitemap
// it "couldn't fetch".
const MAINTENANCE_EXEMPT_PREFIXES = ["/login", "/dashboard", "/fx", "/maintenance", "/robots.txt", "/sitemap.xml"];

// Maintenance mode lives in Postgres (store_settings), but this file runs
// on the Edge runtime (see lib/auth/userSession.ts's own comment: no Node
// `crypto`/`fs`, so no raw `pg` connection), so it comes from a small
// Node-runtime Route Handler instead.
//
// That fetch used to sit in front of the visitor: the value was cached in
// memory for five seconds, and whoever arrived after it expired waited for
// a round trip to the function region plus a Postgres query before their
// page began. Measured against production, that turned an otherwise steady
// page into p50 170ms / p95 548ms / max 1222ms -- the same URL, seven times
// slower depending on whether you happened to be the one paying for the
// refresh. It read as random slowness because that is exactly what it was.
//
// So the refresh moved off the critical path. A stale value is served
// immediately and renewed behind the response via event.waitUntil, which
// means no visitor ever waits for this check once an instance is warm. The
// endpoint is also CDN-cached now (see its route file), so even the one
// cold-start fetch below is served from a nearby edge node.
const MAINTENANCE_TTL_MS = 10_000;

// `null` means "never fetched on this Edge instance" -- distinct from
// `false`, which is a real answer we are entitled to keep serving while a
// refresh runs.
let cachedMaintenanceMode: boolean | null = null;
let cacheExpiresAt = 0;
let inFlight: Promise<void> | null = null;

/**
 * One refresh at a time per instance. Without the shared promise, every
 * request arriving during a refresh would start its own -- a stampede
 * against the endpoint precisely when it is already being asked.
 */
function refreshMaintenanceMode(origin: string): Promise<void> {
  if (inFlight) return inFlight;
  inFlight = (async () => {
    try {
      const res = await fetch(new URL("/api/internal/maintenance-status", origin));
      const data = (await res.json()) as { maintenanceMode?: boolean };
      cachedMaintenanceMode = data.maintenanceMode === true;
    } catch {
      // Fail open on the check itself failing (e.g. the DB is briefly
      // unreachable) -- a broken maintenance check shouldn't take the whole
      // site down on top of whatever's already wrong. An answer we already
      // hold is better than that guess, so it survives.
      cachedMaintenanceMode = cachedMaintenanceMode ?? false;
    } finally {
      // Set even after a failure, so an endpoint that is down is retried on
      // the usual beat instead of on every single request.
      cacheExpiresAt = Date.now() + MAINTENANCE_TTL_MS;
      inFlight = null;
    }
  })();
  return inFlight;
}

async function getMaintenanceMode(origin: string, event: NextFetchEvent): Promise<boolean> {
  if (cachedMaintenanceMode !== null) {
    if (Date.now() >= cacheExpiresAt) {
      // Stale. Serve what we have and renew behind the response.
      //
      // The trade this makes: for a few seconds after the switch is thrown,
      // one request per Edge instance still sees the site. Maintenance is a
      // planned, occasional act and admins bypass it entirely, so that is
      // a cheaper price than every visitor risking a second-long stall for
      // the rest of the site's life.
      event.waitUntil(refreshMaintenanceMode(origin));
    }
    return cachedMaintenanceMode;
  }
  // Cold instance: nothing to serve yet, so this one request does wait.
  await refreshMaintenanceMode(origin);
  return cachedMaintenanceMode ?? false;
}

const CANONICAL_HOST = "atoreum.mv";

export async function middleware(request: NextRequest, event: NextFetchEvent) {
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

  if (pathname.startsWith("/dashboard") || pathname.startsWith("/fx")) {
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
  if (!exempt && !isAdminRole(session?.role) && (await getMaintenanceMode(request.nextUrl.origin, event))) {
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
