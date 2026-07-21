import Link from "next/link";

export default function Footer() {
  return (
    <footer className="border-t border-line bg-ink px-6 py-16 md:px-12">
      <div className="mx-auto flex max-w-[1440px] flex-col gap-12 md:flex-row md:justify-between">
        <div className="max-w-sm">
          <p className="font-display text-lg tracking-[0.25em] text-ivory uppercase">
            Atoreum <span className="text-gold">MV</span>
          </p>
          <p className="mt-4 text-sm leading-relaxed text-ivory-dim">
            Atoreum MV introduces Lebelage to the Maldives — premium Korean skincare curated for island life.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-12 sm:grid-cols-3">
          <div>
            <p className="text-xs tracking-[0.2em] text-sand uppercase">Shop</p>
            <div className="mt-4 flex flex-col gap-3">
              <Link href="/products" className="text-sm text-ivory-dim hover:text-gold">
                Full Collection
              </Link>
              <Link href="/products" className="text-sm text-ivory-dim hover:text-gold">
                Skincare
              </Link>
              <Link href="/products" className="text-sm text-ivory-dim hover:text-gold">
                Fragrance
              </Link>
            </div>
          </div>

          <div>
            <p className="text-xs tracking-[0.2em] text-sand uppercase">Company</p>
            <div className="mt-4 flex flex-col gap-3">
              <Link href="/" className="text-sm text-ivory-dim hover:text-gold">
                About
              </Link>
              <span className="text-sm text-ivory-dim/50">Contact</span>
              <span className="text-sm text-ivory-dim/50">Concierge</span>
            </div>
          </div>

          <div>
            <p className="text-xs tracking-[0.2em] text-sand uppercase">Based In</p>
            <div className="mt-4 flex flex-col gap-3">
              <span className="text-sm text-ivory-dim">Malé, Maldives</span>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto mt-16 flex max-w-[1440px] flex-col items-start justify-between gap-4 border-t border-line pt-8 text-xs text-ivory-dim/60 md:flex-row md:items-center">
        <span>© {new Date().getFullYear()} Atoreum MV. All rights reserved.</span>
        <span>Official Lebelage launch in the Maldives.</span>
      </div>
    </footer>
  );
}
