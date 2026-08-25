import { NextResponse } from "next/server";
import { getSettings } from "@/lib/data/settings.server";

/**
 * Node-runtime endpoint middleware.ts fetches to check maintenance mode.
 * Middleware runs on the Edge runtime (see lib/auth/userSession.ts's own
 * comment on why -- no Node `crypto`/`fs`, no raw Postgres connection), so
 * it can't query store_settings directly; this small Route Handler is the
 * bridge. Not meant to be called from the browser -- there's nothing
 * sensitive in the response, so it isn't auth-gated, but it's under /api
 * (excluded from the sitemap/normal navigation) rather than a public route.
 *
 * Cached at the CDN rather than answered from Postgres every time. This used
 * to be `no-store`, so each call ran a query in the function region and came
 * back in ~500ms; middleware calls it on a timer, which put that half second
 * in front of whichever visitor happened to arrive as the timer expired.
 * One boolean that changes a few times a year does not need to be read from
 * the database on demand.
 *
 * `stale-while-revalidate` is what keeps the database off the request path
 * entirely: once the ten seconds are up an edge node still answers instantly
 * from what it holds and refreshes itself afterwards. Combined with the
 * caching in middleware, throwing the switch takes effect within about
 * twenty seconds rather than instantly -- the tradeoff already noted on the
 * settings page, slightly longer.
 */
export async function GET() {
  const settings = await getSettings();
  return NextResponse.json(
    { maintenanceMode: settings.maintenanceMode },
    { headers: { "Cache-Control": "public, s-maxage=10, stale-while-revalidate=60" } }
  );
}
