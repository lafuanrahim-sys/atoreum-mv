"use client";

import { useState } from "react";
import Link from "next/link";
import DashboardNav from "@/components/dashboard/DashboardNav";
import Logo from "@/components/ui/Logo";
import { cn } from "@/lib/utils";

/**
 * Admin portal shell. The sidebar is a fixed, always-visible column on wide
 * screens (lg+, matching the storefront header's own desktop-nav threshold)
 * — below that it collapses into a slide-in drawer behind a hamburger
 * trigger, same pattern as the storefront's mobile menu. Without this, the
 * fixed 240px sidebar plus its ml-60 content offset left as little as ~150px
 * for the main pane on a phone-width screen.
 */
export default function DashboardShell({
  user,
  isDark,
  unreadMessages,
  toggleThemeAction,
  logoutAction,
  children,
}: {
  user: { name: string; role: string };
  isDark: boolean;
  unreadMessages: number;
  toggleThemeAction: () => Promise<void>;
  logoutAction: () => Promise<void>;
  children: React.ReactNode;
}) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  const sidebarContent = (
    <>
      <Link href="/products" className="flex items-center gap-3 px-2">
        <span className="block h-9 w-9">
          <Logo />
        </span>
        <span className="font-display text-sm uppercase tracking-[0.2em] text-ivory">
          Atoreum <span className="text-gold">MV</span>
        </span>
      </Link>

      <div className="mt-8 flex-1">
        <DashboardNav unreadMessages={unreadMessages} onNavigate={() => setDrawerOpen(false)} />
      </div>

      <div className="border-t border-line pt-4">
        <form action={toggleThemeAction} className="px-2">
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
    </>
  );

  return (
    <div className="flex min-h-screen bg-ink-2">
      {/* Wide screens: always-on fixed column. */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 flex-col border-r border-line bg-ink px-4 py-6 lg:flex">
        {sidebarContent}
      </aside>

      {/* Narrow screens: compact top bar with a hamburger trigger. */}
      <header className="fixed inset-x-0 top-0 z-40 flex items-center justify-between border-b border-line bg-ink px-4 py-3 lg:hidden">
        <Link href="/products" className="flex items-center gap-2.5">
          <span className="block h-8 w-8">
            <Logo />
          </span>
          <span className="font-display text-xs uppercase tracking-[0.2em] text-ivory">
            Atoreum <span className="text-gold">MV</span>
          </span>
        </Link>
        <button
          type="button"
          aria-label="Toggle dashboard menu"
          aria-expanded={drawerOpen}
          className="flex flex-col gap-1.5 p-2"
          onClick={() => setDrawerOpen((v) => !v)}
        >
          <span
            className={cn(
              "h-px w-6 bg-ivory transition-transform duration-300",
              drawerOpen && "translate-y-[3.5px] rotate-45"
            )}
          />
          <span
            className={cn(
              "h-px w-6 bg-ivory transition-transform duration-300",
              drawerOpen && "-translate-y-[3.5px] -rotate-45"
            )}
          />
        </button>
      </header>

      {/* Narrow screens: backdrop + slide-in drawer, same mechanics as the
          storefront cart drawer (inert while closed so its controls drop out
          of the tab order instead of staying keyboard-reachable offscreen). */}
      <div
        className={cn(
          "fixed inset-0 z-40 bg-ink/60 backdrop-blur-sm transition-opacity duration-300 lg:hidden",
          drawerOpen ? "opacity-100" : "pointer-events-none opacity-0"
        )}
        onClick={() => setDrawerOpen(false)}
        aria-hidden="true"
      />
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] flex-col border-r border-line bg-ink px-4 py-6 shadow-2xl transition-transform duration-300 lg:hidden",
          drawerOpen ? "translate-x-0" : "-translate-x-full"
        )}
        inert={!drawerOpen}
      >
        {sidebarContent}
      </aside>

      <main className="min-h-screen flex-1 px-4 pt-20 pb-8 sm:px-6 lg:ml-60 lg:px-8 lg:pt-8">{children}</main>
    </div>
  );
}
