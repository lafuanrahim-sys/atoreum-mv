"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useScrollReveal } from "@/hooks/useScrollReveal";
import { useChromeHidden } from "@/lib/layout/ChromeVisibility";

export default function Footer() {
  const pathname = usePathname();
  const chromeHidden = useChromeHidden();
  const ref = useScrollReveal<HTMLElement>({ start: "top 92%" });
  // Hidden on the homepage (by design), inside the admin dashboard (which
  // has its own shell), and on the maintenance page (deliberately
  // chrome-free -- nothing on it should link back into the site).
  // chromeHidden is the reliable signal for the latter two (see
  // lib/layout/ChromeVisibility.tsx) -- usePathname() alone can lag behind
  // a Server Action redirect that middleware further redirects.
  // Also off on /login: that page composes its own self-contained scene
  // (crest, threshold arch, wayfinding line) instead of handing off to the
  // site chrome at the bottom -- a standard footer would just restate the
  // same "Malé, Maldives" fact a second time in a completely different register.
  if (chromeHidden || pathname === "/" || pathname === "/login" || pathname.startsWith("/dashboard") || pathname === "/maintenance") return null;

  return (
    <footer ref={ref} className="page-gutter border-t border-line bg-ink py-16">
      <div className="flex flex-col gap-12 lg:flex-row lg:justify-between">
        <div data-reveal className="max-w-sm">
          <p className="font-display text-lg tracking-[0.25em] text-ivory uppercase">
            Atoreum <span className="text-gold">MV</span>
          </p>
          <p className="mt-4 text-sm leading-relaxed text-ivory-dim">
            Atoreum MV introduces Lebelage to the Maldives with premium Korean skincare curated for island life.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-12 sm:grid-cols-3">
          <div data-reveal>
            <p className="text-xs tracking-[0.2em] text-sand uppercase">Shop</p>
            <div className="mt-4 flex flex-col gap-3">
              <Link href="/products" className="text-sm text-ivory-dim transition-colors hover:text-gold">
                Full Collection
              </Link>
            </div>
          </div>

          <div data-reveal>
            <p className="text-xs tracking-[0.2em] text-sand uppercase">Company</p>
            <div className="mt-4 flex flex-col gap-3">
              <Link href="/about" className="text-sm text-ivory-dim transition-colors hover:text-gold">
                About
              </Link>
              <Link href="/contact" className="text-sm text-ivory-dim transition-colors hover:text-gold">
                Contact
              </Link>
            </div>
          </div>

          <div data-reveal>
            <p className="text-xs tracking-[0.2em] text-sand uppercase">Based In</p>
            <div className="mt-4 flex flex-col gap-3">
              <span className="text-sm text-ivory-dim">Malé, Maldives</span>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-16 flex flex-col items-start justify-between gap-4 border-t border-line pt-8 text-xs text-ivory-dim/60 md:flex-row md:items-center">
        <span>© {new Date().getFullYear()} Atoreum MV by Aranzo. All rights reserved.</span>
        <span>Official Lebelage launch in the Maldives.</span>
      </div>
    </footer>
  );
}
