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
 */
export async function GET() {
  const settings = await getSettings();
  return NextResponse.json(
    { maintenanceMode: settings.maintenanceMode },
    { headers: { "Cache-Control": "no-store" } }
  );
}
