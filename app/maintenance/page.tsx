import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSettings } from "@/lib/data/settings.server";
import MaintenancePage from "@/components/layout/MaintenancePage";

export const metadata: Metadata = {
  title: "We'll be back shortly",
  // Maintenance mode redirects every storefront URL here. Without this, a
  // crawl during a maintenance window can replace real indexed pages with
  // this one -- the whole site reduced to "back shortly" in search results,
  // which outlasts the maintenance by however long reindexing takes.
  robots: { index: false, follow: false },
};

// Without this, Next statically prerenders the page at build time -- the
// getSettings() check below would run exactly once, then, get baked into
// the static HTML forever, never seeing a maintenance_mode flip that
// happens after deploy. force-dynamic makes it re-run the DB check on
// every request instead, same as the rest of the maintenance-mode wiring
// (middleware.ts polls it live too, just with a short cache).
export const dynamic = "force-dynamic";

/**
 * Real route middleware.ts redirects every non-exempt path to while
 * maintenance mode is on (see middleware.ts). /maintenance is itself exempt
 * from that redirect, so it stays reachable *as a URL* even once the flag
 * is switched back off -- a bookmark, an old share link, or just landing
 * here and hitting refresh -- and without this check it would keep
 * rendering the "we're offline" page while the store was actually live.
 * Bounces straight back to the real homepage whenever that's the case, no
 * exceptions for admins either: there's no scenario where this page should
 * say the store is offline while it demonstrably isn't. Header/Footer both
 * self-hide on this path (same pattern they already use for /dashboard) so
 * nothing here links back into the "offline" site.
 */
export default async function Maintenance() {
  const settings = await getSettings();
  if (!settings.maintenanceMode) {
    redirect("/");
  }
  return <MaintenancePage />;
}
