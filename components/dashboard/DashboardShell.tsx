"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import DashboardNav from "@/components/dashboard/DashboardNav";
import Logo from "@/components/ui/Logo";
import ToastProvider from "@/components/dashboard/ToastProvider";
import { cn } from "@/lib/utils";
import { HideChrome } from "@/lib/layout/ChromeVisibility";

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
  fxMarketRate,
  toggleThemeAction,
  logoutAction,
  children,
}: {
  user: { name: string; role: string };
  isDark: boolean;
  unreadMessages: number;
  fxMarketRate: number;
  toggleThemeAction: () => Promise<void>;
  logoutAction: () => Promise<void>;
  children: React.ReactNode;
}) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  // <body>'s own background (globals.css) is otherwise pinned to the
  // storefront's light/dark tokens, not the admin palette this whole shell
  // renders with (dashboard-theme, scoped to the wrapping div in
  // app/dashboard/layout.tsx) -- invisible on desktop since admin content
  // always fills the viewport, but mobile's rubber-band overscroll bounce
  // briefly scrolls past that div's edge and reveals real <body> background
  // underneath, flashing the storefront's theme behind the admin's. Mirror
  // the same two classes onto <body> directly so that gap matches too; undo
  // on unmount so the storefront gets its own tokens back once you navigate
  // away from /dashboard.
  useEffect(() => {
    document.body.classList.add("dashboard-theme");
    document.body.classList.toggle("dashboard-dark", isDark);
    return () => {
      document.body.classList.remove("dashboard-theme", "dashboard-dark");
    };
  }, [isDark]);

  const sidebarContent = (
    <>
      <Link href="/products" className="flex items-center gap-3 px-4 pb-5">
        <span className="block h-8 w-8 shrink-0">
          <Logo />
        </span>
        <span className="min-w-0">
          <span className="block font-admin-heading text-sm leading-tight text-ivory">Atoreum MV</span>
          <span className="block font-mono text-[9px] uppercase tracking-[0.3em] text-sand">Admin</span>
        </span>
      </Link>

      <form action="/dashboard/search" method="get" className="relative border-y border-line px-4 py-3">
        <svg viewBox="0 0 20 20" aria-hidden="true" className="pointer-events-none absolute left-6 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ivory-dim">
          <circle cx="8.5" cy="8.5" r="6" fill="none" stroke="currentColor" strokeWidth="1.4" />
          <path d="M13 13l4.5 4.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
        <input
          type="search"
          name="q"
          placeholder="Search the ledger…"
          onClick={() => setDrawerOpen(false)}
          className="w-full bg-transparent py-1 pl-6 pr-1 font-mono text-xs text-ivory placeholder:text-ivory-dim/70 focus:outline-none"
        />
      </form>

      <div className="flex-1 overflow-x-hidden overflow-y-auto py-2">
        <DashboardNav unreadMessages={unreadMessages} onNavigate={() => setDrawerOpen(false)} />
      </div>

      <div className="border-t border-line px-4 pt-4">
        <form action={toggleThemeAction}>
          <button
            type="submit"
            className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-ivory-dim transition-colors hover:text-gold-deep"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-3.5 w-3.5">
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

        <p className="mt-4 truncate font-admin-heading font-semibold text-ivory">{user.name}</p>
        <p className="font-mono text-[9px] uppercase tracking-[0.25em] text-sand">
          {user.role === "superadmin" ? "Super Admin" : "Store Manager"}
        </p>

        {/* A separate portal, not another nav item -- its own shell
            (components/fx/FxPortalShell.tsx) at its own top-level route
            (/fx, outside /dashboard entirely), for the two people who use
            it. Grouped here with the other "leave this shell" actions
            rather than mixed into DashboardNav's flat list above. */}
        <Link
          href="/fx"
          className="mt-4 flex items-center justify-between border-y border-line py-3 font-mono text-[10px] uppercase tracking-[0.15em] text-ivory-dim transition-colors hover:text-gold-deep"
        >
          Dollar Exchange
          <span className="flex items-center gap-2">
            <span className="tabular-nums text-ivory">{fxMarketRate.toFixed(2)}</span>
            <span aria-hidden="true">→</span>
          </span>
        </Link>

        <div className="mt-3 flex items-center justify-between pb-4">
          <Link href="/" className="font-mono text-[10px] uppercase tracking-[0.15em] text-ivory-dim transition-colors hover:text-gold-deep">
            ← View store
          </Link>
          <form action={logoutAction}>
            <button
              type="submit"
              className="font-mono text-[10px] uppercase tracking-[0.15em] text-ivory-dim transition-colors hover:text-gold-deep"
            >
              Log out
            </button>
          </form>
        </div>
      </div>
    </>
  );

  return (
    <ToastProvider>
    <div className="flex min-h-screen bg-ink-2">
      <HideChrome />
      {/* Wide screens: always-on fixed column. */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-line bg-ink pt-6 lg:flex">
        {sidebarContent}
      </aside>

      {/* Narrow screens: compact top bar with a hamburger trigger. */}
      <header className="fixed inset-x-0 top-0 z-40 flex items-center justify-between border-b border-line bg-ink px-4 py-3 lg:hidden">
        <Link href="/products" className="flex items-center gap-2.5">
          <span className="block h-8 w-8">
            <Logo />
          </span>
          <span>
            <span className="block font-admin-heading text-sm leading-tight text-ivory">Atoreum MV</span>
            <span className="block font-mono text-[8px] uppercase tracking-[0.3em] text-sand">Admin</span>
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
          "fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] flex-col border-r border-line bg-ink pt-6 shadow-2xl transition-transform duration-300 lg:hidden",
          drawerOpen ? "translate-x-0" : "-translate-x-full"
        )}
        inert={!drawerOpen}
      >
        {sidebarContent}
      </aside>

      {/* min-w-0 overrides a flex item's default min-width: auto, which
          otherwise lets intrinsically-wide content (a data table, e.g.)
          grow this pane past the viewport instead of scrolling within its
          own overflow-x-auto wrapper -- confirmed on /dashboard/customers,
          where the table pushed the whole page into horizontal scroll on
          mobile despite already being wrapped for it. */}
      <main className="min-h-screen min-w-0 flex-1 px-4 pt-20 pb-8 sm:px-6 lg:ml-64 lg:px-10 lg:pt-10">{children}</main>
    </div>
    </ToastProvider>
  );
}
