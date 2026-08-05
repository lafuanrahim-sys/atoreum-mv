"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Logo from "@/components/ui/Logo";
import ToastProvider from "@/components/dashboard/ToastProvider";
import { cn } from "@/lib/utils";
import { HideChrome } from "@/lib/layout/ChromeVisibility";

const NAV_ITEMS = [
  { href: "/fx", label: "Dashboard", exact: true },
  { href: "/fx/exchange", label: "Exchange Log" },
  { href: "/fx/tt", label: "TT Log" },
  { href: "/fx/settings", label: "Rates & Settings" },
];

/**
 * Dollar Exchange is its own portal, not another item in the storefront
 * admin's sidebar (see components/dashboard/DashboardShell.tsx) -- a
 * distinct top-bar shell instead of that fixed left sidebar, so it reads
 * as a separate tool for the two people who use it, not one more section
 * among Products/Orders/Reviews. Same admin palette/tokens either way
 * (dashboard-theme, set by app/fx/layout.tsx exactly like app/dashboard/
 * layout.tsx does) -- still visibly the same brand, just a different room.
 */
export default function FxPortalShell({
  user,
  isDark,
  toggleThemeAction,
  logoutAction,
  children,
}: {
  user: { name: string; role: string };
  isDark: boolean;
  toggleThemeAction: () => Promise<void>;
  logoutAction: () => Promise<void>;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  // Same reasoning as DashboardShell's own identical effect -- <body>'s
  // background is otherwise pinned to the storefront's tokens, briefly
  // visible through mobile's rubber-band overscroll without this.
  useEffect(() => {
    document.body.classList.add("dashboard-theme");
    document.body.classList.toggle("dashboard-dark", isDark);
    return () => {
      document.body.classList.remove("dashboard-theme", "dashboard-dark");
    };
  }, [isDark]);

  return (
    <ToastProvider>
      <div className="min-h-screen bg-ink-2">
        <HideChrome />
        <header className="sticky top-0 z-40 border-b border-line bg-ink">
          <div className="flex items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-10">
            <div className="flex items-center gap-6">
              <Link href="/fx" className="flex items-center gap-2.5">
                <span className="block h-7 w-7 shrink-0">
                  <Logo />
                </span>
                <span className="min-w-0">
                  <span className="block font-admin-heading text-sm leading-tight text-ivory">Atoreum MV</span>
                  <span className="block font-mono text-[8px] uppercase tracking-[0.3em] text-sand">Dollar Exchange</span>
                </span>
              </Link>

              <nav className="hidden items-center gap-5 lg:flex">
                {NAV_ITEMS.map((item) => {
                  const isActive = item.exact ? pathname === item.href : pathname.startsWith(item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      aria-current={isActive ? "page" : undefined}
                      className={cn(
                        "font-mono text-[11px] uppercase tracking-[0.15em] transition-colors",
                        isActive ? "text-gold-deep" : "text-ivory-dim hover:text-ivory"
                      )}
                    >
                      {item.label}
                    </Link>
                  );
                })}
              </nav>
            </div>

            <div className="hidden items-center gap-5 lg:flex">
              <form action={toggleThemeAction}>
                <button
                  type="submit"
                  aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
                  className="flex h-8 w-8 items-center justify-center text-ivory-dim transition-colors hover:text-gold-deep"
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
                </button>
              </form>

              <div className="text-right">
                <p className="truncate font-admin-heading text-sm font-semibold text-ivory">{user.name}</p>
                <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-sand">
                  {user.role === "superadmin" ? "Super Admin" : "Store Manager"}
                </p>
              </div>

              <div className="flex items-center gap-4 border-l border-line pl-5">
                <Link href="/dashboard" className="font-mono text-[10px] uppercase tracking-[0.15em] text-ivory-dim transition-colors hover:text-gold-deep">
                  ← Store Admin
                </Link>
                <form action={logoutAction}>
                  <button type="submit" className="font-mono text-[10px] uppercase tracking-[0.15em] text-ivory-dim transition-colors hover:text-gold-deep">
                    Log out
                  </button>
                </form>
              </div>
            </div>

            <button
              type="button"
              aria-label="Toggle menu"
              aria-expanded={menuOpen}
              className="flex flex-col gap-1.5 p-2 lg:hidden"
              onClick={() => setMenuOpen((v) => !v)}
            >
              <span className={cn("h-px w-6 bg-ivory transition-transform duration-300", menuOpen && "translate-y-[3.5px] rotate-45")} />
              <span className={cn("h-px w-6 bg-ivory transition-transform duration-300", menuOpen && "-translate-y-[3.5px] -rotate-45")} />
            </button>
          </div>

          {menuOpen && (
            <div className="flex flex-col gap-5 border-t border-line px-4 py-5 lg:hidden">
              <nav className="flex flex-col gap-4">
                {NAV_ITEMS.map((item) => {
                  const isActive = item.exact ? pathname === item.href : pathname.startsWith(item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMenuOpen(false)}
                      aria-current={isActive ? "page" : undefined}
                      className={cn(
                        "font-mono text-xs uppercase tracking-[0.15em] transition-colors",
                        isActive ? "text-gold-deep" : "text-ivory-dim hover:text-ivory"
                      )}
                    >
                      {item.label}
                    </Link>
                  );
                })}
              </nav>
              <div className="flex items-center justify-between border-t border-line pt-4">
                <form action={toggleThemeAction}>
                  <button type="submit" className="font-mono text-[10px] uppercase tracking-[0.15em] text-ivory-dim">
                    {isDark ? "Light mode" : "Dark mode"}
                  </button>
                </form>
                <Link href="/dashboard" className="font-mono text-[10px] uppercase tracking-[0.15em] text-ivory-dim">
                  ← Store Admin
                </Link>
                <form action={logoutAction}>
                  <button type="submit" className="font-mono text-[10px] uppercase tracking-[0.15em] text-ivory-dim">
                    Log out
                  </button>
                </form>
              </div>
            </div>
          )}
        </header>

        <main className="min-w-0 px-4 py-8 sm:px-6 lg:px-10 lg:py-10">{children}</main>
      </div>
    </ToastProvider>
  );
}
