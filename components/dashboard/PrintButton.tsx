"use client";

/**
 * Opens the browser's print dialog. A client component purely because
 * window.print() needs a click handler -- the invoice page itself stays a
 * Server Component so it renders from the database with no hydration.
 */
export default function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="border border-line px-4 py-2 font-mono text-[11px] uppercase tracking-[0.15em] text-ivory-dim transition-colors hover:border-gold-deep hover:text-gold-deep"
    >
      Print / Save PDF
    </button>
  );
}
