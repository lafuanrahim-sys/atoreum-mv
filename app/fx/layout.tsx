import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { getCurrentUser } from "@/lib/auth/currentUser.server";
import { isAdminRole } from "@/lib/auth/userSession";
import { logoutAction } from "@/app/actions/auth";
import { toggleDashboardThemeAction } from "@/app/actions/storeAdmin";
import FxPortalShell from "@/components/fx/FxPortalShell";
import PageTransition from "@/components/ui/PageTransition";

/**
 * Dollar Exchange portal shell — deliberately a sibling of /dashboard, not
 * a route nested inside it. A layout can't opt a child route out of its
 * parent's own layout in the App Router, so giving this its own distinct
 * shell (components/fx/FxPortalShell.tsx) instead of DashboardShell's
 * sidebar meant moving it outside /dashboard entirely. Same admin-only
 * gate as app/dashboard/layout.tsx, re-checked here as defense-in-depth on
 * top of middleware.ts's own /fx block.
 */
export default async function FxLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user || !isAdminRole(user.role)) redirect("/login?from=%2Ffx");

  const cookieStore = await cookies();
  const isDark = cookieStore.get("atoreum_dashboard_theme")?.value === "dark";

  return (
    <div className={`dashboard-theme ${isDark ? "dashboard-dark" : ""} -mt-24 md:-mt-28`}>
      <FxPortalShell
        user={{ name: user.name, role: user.role }}
        isDark={isDark}
        toggleThemeAction={toggleDashboardThemeAction}
        logoutAction={logoutAction}
      >
        <PageTransition>{children}</PageTransition>
      </FxPortalShell>
    </div>
  );
}
