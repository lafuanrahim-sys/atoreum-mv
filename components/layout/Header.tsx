"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import Logo from "@/components/ui/Logo";
import ThemeToggle from "@/components/layout/ThemeToggle";
import CartButton from "@/components/cart/CartButton";

const NAV_LINKS = [
  { href: "/", label: "Home" },
  { href: "/products", label: "Collection" },
  { href: "/about", label: "About Us" },
];

const SCROLL_THRESHOLD = 60;

export default function Header() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const onScroll = () => setIsScrolled(window.scrollY > SCROLL_THRESHOLD);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // The Collection page's hero sits on a fixed, real photo (not a themed
  // bg-ink section) that never flips with light/dark mode, so at the top of
  // that page the header text is pinned to a fixed dark tone regardless of
  // theme. Everywhere else -- and everywhere once scrolled, since the
  // blurred bg-ink backdrop below takes over supplying contrast -- the
  // themed `text-ivory` token (dark in light mode, light in dark mode) is
  // what stays readable.
  const textClass = pathname === "/products" && !isScrolled ? "text-[#241d17]" : "text-ivory";

  return (
    <header
      className={cn(
        "fixed top-0 left-0 right-0 z-50 transition-colors duration-300",
        isScrolled ? "border-b border-ivory/15 bg-ink/95 backdrop-blur-md" : "bg-transparent"
      )}
    >
      <div className="flex w-full items-center justify-between px-6 py-5 md:px-12 lg:px-16 xl:px-20 2xl:px-24">
        <nav className="hidden items-center gap-6 md:flex">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cn("text-xs tracking-[0.2em] uppercase transition-colors hover:text-gold", textClass)}
            >
              {link.label}
            </Link>
          ))}
          <ThemeToggle />
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

        <div className="flex items-center gap-4 md:hidden">
          <CartButton />
          <button
            aria-label="Toggle menu"
            className="flex flex-col gap-1.5"
            onClick={() => setMenuOpen((v) => !v)}
          >
            <span
              className={cn(
                "h-px w-6 bg-ivory transition-transform duration-300",
                menuOpen && "translate-y-[3.5px] rotate-45"
              )}
            />
            <span
              className={cn(
                "h-px w-6 bg-ivory transition-transform duration-300",
                menuOpen && "-translate-y-[3.5px] -rotate-45"
              )}
            />
          </button>
        </div>
      </div>

      {menuOpen && (
        <nav className="flex flex-col gap-6 border-t border-line bg-ink px-6 py-8 md:hidden">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setMenuOpen(false)}
              className="text-sm tracking-[0.2em] uppercase text-ivory-dim hover:text-gold"
            >
              {link.label}
            </Link>
          ))}
        </nav>
      )}
    </header>
  );
}
