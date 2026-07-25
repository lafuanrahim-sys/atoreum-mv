import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/currentUser.server";
import { isAdminRole } from "@/lib/auth/userSession";
import { countUnreadMessages } from "@/lib/data/messages.server";
import { logoutAction } from "@/app/actions/auth";
import { toggleDashboardThemeAction } from "@/app/actions/storeAdmin";
import DashboardNav from "@/components/dashboard/DashboardNav";
import Logo from "@/components/ui/Logo";

/**
 * Admin portal shell: fixed sidebar + content pane, in the spirit of the
 * reference dashboard but built from the site's own tokens. Middleware
 * already gates /dashboard to admins; the layout re-checks as
 * defense-in-depth (and to greet the admin by name).
 */
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user || !isAdminRole(user.role)) redirect("/login?from=%2Fdashboard");

  // Same name as in app/actions/storeAdmin.ts (see note there).
  const cookieStore = await cookies();
  const isDark = cookieStore.get("atoreum_dashboard_theme")?.value === "dark";

  return (
    // -mt cancels the root main's storefront header offset (pt-24/28) —
    // the dashboard owns its full viewport, no marketing chrome above it.
    // dashboard-theme re-pins every token to the admin palette (globals.css).
    <div
      className={`dashboard-theme ${isDark ? "dashboard-dark" : ""} -mt-24 flex min-h-screen bg-ink-2 md:-mt-28`}
    >
      <aside className="fixed inset-y-0 left-0 z-40 flex w-60 flex-col border-r border-line bg-ink px-4 py-6">
        <Link href="/products" className="flex items-center gap-3 px-2">
          <span className="block h-9 w-9">
            <Logo />
          </span>
          <span className="font-display text-sm uppercase tracking-[0.2em] text-ivory">
            Atoreum <span className="text-gold">MV</span>
          </span>
        </Link>

        <div className="mt-8 flex-1">
          <DashboardNav unreadMessages={countUnreadMessages()} />
        </div>

        <div className="border-t border-line pt-4">
          <form action={toggleDashboardThemeAction} className="px-2">
            <button
              type="submit"
              className="flex w-full items-center gap-2 rounded-md py-1.5 text-[11px] uppercase tracking-[0.12em] text-ivory-dim transition-colors hover:text-gold"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-4 w-4">
                {isDark ? (
                  <>
                    <circle cx="12" cy="12" r="4" />
                    <path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5 5l1.4 1.4M17.6 17.6 19 19M5 19l1.4-1.4M17.6 6.4 19 5" strokeLinecap="round" />
                  </>
                ) : (
                  <path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5Z" strokeLinecap="round" strokeLinejoin="round" />
                )}
              </svg>
              {isDark ? "Light mode" : "Dark mode"}
            </button>
          </form>

          <p className="mt-2 truncate px-2 text-xs text-ivory">{user.name}</p>
          <p className="px-2 text-[10px] uppercase tracking-[0.15em] text-ivory-dim">
            {user.role === "superadmin" ? "Super Admin" : "Store Manager"}
          </p>
          <div className="mt-3 flex items-center justify-between px-2">
            <Link href="/" className="text-[11px] text-ivory-dim transition-colors hover:text-gold">
              ← View store
            </Link>
            <form action={logoutAction}>
              <button
                type="submit"
                className="text-[11px] uppercase tracking-[0.1em] text-ivory-dim transition-colors hover:text-gold"
              >
                Log out
              </button>
            </form>
          </div>
        </div>
      </aside>

      <main className="ml-60 min-h-screen flex-1 px-8 py-8">{children}</main>
    </div>
  );
}
