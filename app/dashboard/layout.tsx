import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { getCurrentUser } from "@/lib/auth/currentUser.server";
import { isAdminRole } from "@/lib/auth/userSession";
import { countUnreadMessages } from "@/lib/data/messages.server";
import { getFxSettings } from "@/lib/data/fx.server";
import { logoutAction } from "@/app/actions/auth";
import { toggleDashboardThemeAction } from "@/app/actions/storeAdmin";
import DashboardShell from "@/components/dashboard/DashboardShell";
import PageTransition from "@/components/ui/PageTransition";

/**
 * Admin portal shell: fixed sidebar + content pane, in the spirit of the
 * reference dashboard but built from the site's own tokens. Middleware
 * already gates /dashboard to admins; the layout re-checks as
 * defense-in-depth (and to greet the admin by name). The responsive
 * sidebar/drawer mechanics live in DashboardShell (a client component,
 * since they need interactive open/close state) — this file stays a server
 * component so it can read the session cookie and current user directly.
 */
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user || !isAdminRole(user.role)) redirect("/login?from=%2Fdashboard");

  // Same name as in app/actions/storeAdmin.ts (see note there).
  const cookieStore = await cookies();
  const isDark = cookieStore.get("atoreum_dashboard_theme")?.value === "dark";

  const [unreadMessages, fxSettings] = await Promise.all([countUnreadMessages(), getFxSettings()]);

  return (
    // -mt cancels the root main's storefront header offset (pt-24/28) —
    // the dashboard owns its full viewport, no marketing chrome above it.
    // dashboard-theme re-pins every token to the admin palette (globals.css).
    <div className={`dashboard-theme ${isDark ? "dashboard-dark" : ""} -mt-24 md:-mt-28`}>
      <DashboardShell
        user={{ name: user.name, role: user.role }}
        isDark={isDark}
        unreadMessages={unreadMessages}
        fxMarketRate={fxSettings.latestMarketRate}
        toggleThemeAction={toggleDashboardThemeAction}
        logoutAction={logoutAction}
      >
        {/* Content-only fade -- the sidebar/nav above stays put across
            dashboard navigation, only this pane crossfades. */}
        <PageTransition>{children}</PageTransition>
      </DashboardShell>
    </div>
  );
}
