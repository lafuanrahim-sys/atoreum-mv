"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
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

  useEffect(() => {
    const onScroll = () => setIsScrolled(window.scrollY > SCROLL_THRESHOLD);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

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
  // that page the header text is pinned to a fixed dark tone regardless of
  // theme. Everywhere else -- and everywhere once scrolled, since the
  // blurred bg-ink backdrop below takes over supplying contrast -- the
  // themed `text-ivory` token (dark in light mode, light in dark mode) is
  // what stays readable.
  const onPhotoHero = pathname === "/products" && !isScrolled;
  const textClass = onPhotoHero ? "text-[#241d17]" : "text-ivory";
  const hamburgerBg = onPhotoHero ? "bg-[#241d17]" : "bg-ivory";

  return (
    <header
      className={cn(
        "fixed top-0 left-0 right-0 z-50 transition-colors duration-300",
        isScrolled ? "border-b border-ivory/15 bg-ink/95 backdrop-blur-md" : "bg-transparent"
      )}
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
          <BoliChip />
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

        <div className="flex items-center gap-4 lg:hidden">
          <ProfileButton />
          <BoliChip />
          <CartButton />
          <button
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
        <nav className="flex flex-col gap-6 border-t border-line bg-ink px-6 py-8 lg:hidden">
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
