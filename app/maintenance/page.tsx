import type { Metadata } from "next";
import MaintenancePage from "@/components/layout/MaintenancePage";

export const metadata: Metadata = {
  title: "We'll be back shortly — Atoreum MV",
};

/**
 * Real route middleware.ts redirects every non-exempt path to while
 * maintenance mode is on (see middleware.ts). Header/Footer both self-hide
 * on this path (same pattern they already use for /dashboard) so nothing
 * here links back into the "offline" site.
 */
export default function Maintenance() {
  return <MaintenancePage />;
}
