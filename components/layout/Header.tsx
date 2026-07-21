"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import Logo from "@/components/ui/Logo";
import ThemeToggle from "@/components/layout/ThemeToggle";

const NAV_LINKS = [
  { href: "/", label: "Home" },
  { href: "/products", label: "Collection" },
];

export default function Header() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={cn(
        "fixed top-0 left-0 right-0 z-50 transition-colors duration-500",
        scrolled ? "bg-ink/90 backdrop-blur-md" : "bg-transparent"
      )}
    >
      <div className="flex w-full items-center justify-between px-6 py-5 md:px-12 lg:px-16 xl:px-20 2xl:px-24">
        <Link href="/" className="flex items-center gap-3">
          <span className="block h-10 w-10">
            <Logo />
          </span>
          <span className="font-display text-lg uppercase tracking-[0.25em] text-ivory">
            Atoreum <span className="text-gold">MV</span>
          </span>
        </Link>

        <nav className="hidden items-center gap-6 md:flex">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-xs tracking-[0.2em] uppercase text-ivory-dim transition-colors hover:text-gold"
            >
              {link.label}
            </Link>
          ))}
          <Link
            href="/products"
            className="rounded-full bg-gold px-5 py-2 text-xs tracking-[0.2em] uppercase text-ink transition-all duration-300 hover:bg-gold/90"
          >
            Shop the launch
          </Link>
          <ThemeToggle />
        </nav>

        <button
          aria-label="Toggle menu"
          className="flex flex-col gap-1.5 md:hidden"
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
