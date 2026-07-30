"use client";

import Link from "next/link";
import { Suspense, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import Logo from "@/components/ui/Logo";
import ThemeToggle from "@/components/layout/ThemeToggle";
import ProfileButton from "@/components/layout/ProfileButton";
import BoliChip from "@/components/layout/BoliChip";
import CartButton from "@/components/cart/CartButton";
import { useChromeHidden } from "@/lib/layout/ChromeVisibility";

const NAV_LINKS = [
  { href: "/", label: "Home" },
  { href: "/products", label: "Collection" },
  { href: "/about", label: "About Us" },
  { href: "/contact", label: "Contact" },
];

const SCROLL_THRESHOLD = 60;

export default function Header() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const pathname = usePathname();
  const chromeHidden = useChromeHidden();
  const menuRef = useRef<HTMLElement | null>(null);
  const toggleRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    const onScroll = () => setIsScrolled(window.scrollY > SCROLL_THRESHOLD);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Tapping anywhere outside the open dropdown (or its own toggle button,
  // which handles its own open/close) closes it -- previously the only way
  // out was pressing the hamburger again. pointerdown (not click) so it
  // reacts on touch-down like the rest of the site's tap feedback, and only
  // listens while the menu is actually open.
  useEffect(() => {
    if (!menuOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (menuRef.current?.contains(target)) return;
      if (toggleRef.current?.contains(target)) return;
      setMenuOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [menuOpen]);

  // The admin dashboard brings its own shell (sidebar + identity), so the
  // storefront chrome stays out of it entirely. The maintenance page is
  // deliberately chrome-free too — nothing on it should link back into the
  // (intentionally offline) rest of the site. chromeHidden is the reliable
  // signal (see lib/layout/ChromeVisibility.tsx) -- usePathname() alone can
  // lag behind a Server Action redirect that middleware further redirects,
  // confirmed in testing; kept as a fallback since it's usually correct too.
  // After the hooks — early returns must never sit between hook calls.
  if (chromeHidden || pathname.startsWith("/dashboard") || pathname === "/maintenance") return null;

  // The Collection page's hero sits on a fixed, real photo (not a themed
  // bg-ink section) that never flips with light/dark mode, so at the top of
  // that page -- before the glass backdrop below has appeared -- the header
  // text is pinned to a fixed dark tone regardless of theme. Everywhere else
  // -- and everywhere once scrolled, since the blurred glass panel takes
  // over supplying contrast -- the themed `text-ivory` token is what stays
  // readable.
  const onPhotoHero = pathname === "/products" && !isScrolled;
  const textClass = onPhotoHero ? "text-[#241d17]" : "text-ivory";
  const hamburgerBg = onPhotoHero ? "bg-[#241d17]" : "bg-ivory";

  return (
    <header
      // Glass only once scrolled a bit -- bare transparent at the very top
      // of the page, same as before the "always glass" experiment, just
      // with the strengthened sheen/highlight/shadow treatment once it
      // does appear.
      className={cn(
        "fixed top-0 left-0 right-0 z-50 transition-colors duration-300",
        isScrolled
          ? "border-b border-ivory/15 bg-ink/60 bg-[linear-gradient(145deg,rgba(255,255,255,0.07),rgba(255,255,255,0)_55%)] shadow-[0_1px_0_0_rgba(255,255,255,0.08)_inset,0_12px_30px_-18px_rgba(0,0,0,0.55)] backdrop-blur-xl backdrop-saturate-150"
          : "bg-transparent"
      )}
      // Keeps the header pinned to what's actually visible instead of the
      // layout viewport's fixed origin when pinch-zoomed/panned -- see
      // lib/layout/VisualViewportSync.tsx. No-op (0px) at normal zoom.
      style={{ transform: "translate(var(--vv-offset-x, 0px), var(--vv-offset-y, 0px))" }}
    >
      <div className="flex w-full items-center justify-between px-6 py-5 md:px-12 lg:px-16 xl:px-20 2xl:px-24">
        <nav className="hidden items-center gap-6 lg:flex">
          {NAV_LINKS.map((link) => {
            // Sub-routes keep their section lit (/products/abc → Collection).
            const isActive =
              pathname === link.href ||
              (link.href !== "/" && pathname.startsWith(link.href + "/"));
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "relative text-xs tracking-[0.2em] uppercase transition-colors hover:text-gold",
                  "after:absolute after:-bottom-1.5 after:left-0 after:h-px after:w-full after:origin-left after:scale-x-0 after:bg-current after:transition-transform after:duration-300",
                  isActive && "after:scale-x-100",
                  isActive && !onPhotoHero ? "text-gold" : textClass
                )}
              >
                {link.label}
              </Link>
            );
          })}
          <ThemeToggle />
          <ProfileButton />
          {/* BoliChip reads useSearchParams() (to refetch when the dive
              game's own searchParams-only navigation changes the balance --
              see its own comment) -- Next requires a Suspense boundary
              around any client component that does, or static prerendering
              of pages without one of their own (the auto-generated 404,
              notably) fails the production build outright. fallback={null}
              since the chip already renders nothing until it has a real
              balance to show. */}
          <Suspense fallback={null}>
            <BoliChip />
          </Suspense>
          <CartButton />
        </nav>

        <Link href="/" className="flex items-center gap-3">
          <span className="block h-10 w-10">
            <Logo />
          </span>
          <span className={cn("font-display text-lg uppercase tracking-[0.25em]", textClass)}>
            Atoreum <span className="text-gold">MV</span>
          </span>
        </Link>

        {/* gap-2 (not gap-4, used elsewhere) -- with a Boli balance chip
            showing (signed-in visitors), the logo wordmark plus all four
            icons don't fit a phone-width row at the wider gap: the icon
            group overflowed its own padding by ~19px, rendering right up
            against the screen edge instead of respecting px-6. */}
        <div className="flex items-center gap-2 lg:hidden">
          <ProfileButton />
          <Suspense fallback={null}>
            <BoliChip />
          </Suspense>
          <CartButton />
          <button
            ref={toggleRef}
            aria-label="Toggle menu"
            aria-expanded={menuOpen}
            className="flex flex-col gap-1.5"
            onClick={() => setMenuOpen((v) => !v)}
          >
            <span
              className={cn(
                "h-px w-6 transition-transform duration-300",
                hamburgerBg,
                menuOpen && "translate-y-[3.5px] rotate-45"
              )}
            />
            <span
              className={cn(
                "h-px w-6 transition-transform duration-300",
                hamburgerBg,
                menuOpen && "-translate-y-[3.5px] -rotate-45"
              )}
            />
          </button>
        </div>
      </div>

      {menuOpen && (
        <nav
          ref={menuRef}
          // Same tint/sheen/highlight recipe as the header's own scrolled
          // glass -- previously a noticeably darker, differently-angled
          // sheen (bg-ink/75 vs the header's /60), which read as a
          // mismatched second material instead of the same pane continuing
          // down. Keeps its own larger drop shadow since it's a floating
          // panel over whatever content is beneath it.
          className="flex flex-col gap-6 border-t border-ivory/15 bg-ink/60 bg-[linear-gradient(145deg,rgba(255,255,255,0.07),rgba(255,255,255,0)_55%)] px-6 py-8 shadow-[0_1px_0_0_rgba(255,255,255,0.08)_inset,0_20px_40px_-24px_rgba(0,0,0,0.6)] backdrop-blur-xl backdrop-saturate-150 lg:hidden"
        >
          {NAV_LINKS.map((link) => {
            const isActive =
              pathname === link.href ||
              (link.href !== "/" && pathname.startsWith(link.href + "/"));
            return (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMenuOpen(false)}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "text-sm tracking-[0.2em] uppercase transition-colors hover:text-gold",
                  isActive ? "text-gold" : "text-ivory-dim"
                )}
              >
                {link.label}
              </Link>
            );
          })}
          <div className="flex items-center justify-between border-t border-line pt-6">
            <span className="text-sm tracking-[0.2em] uppercase text-ivory-dim">Theme</span>
            <ThemeToggle />
          </div>
        </nav>
      )}
    </header>
  );
}
