import MaintenanceLogo from "@/components/layout/MaintenanceLogo";
import { HideChrome } from "@/lib/layout/ChromeVisibility";

/**
 * Shown in place of the entire site when maintenance mode is on (see
 * middleware.ts) -- no header, nav, or footer, so there's nothing here for
 * a visitor to click through to the rest of the (intentionally offline)
 * store. Mounts HideChrome rather than relying solely on Header/Footer's
 * own pathname check, since that can lag behind certain redirect chains
 * (see lib/layout/ChromeVisibility.tsx).
 */
export default function MaintenancePage() {
  return (
    // Fixed + inset-0, not min-h-screen -- this renders inside root
    // layout's <main>, which reserves pt-24/28 for the (here, hidden)
    // header. min-h-screen is relative to normal document flow, so that
    // padding pushed the whole page taller than the viewport and made it
    // scrollable. Pinning directly to the viewport sidesteps the ancestor
    // padding entirely and guarantees no scroll.
    <div className="fixed inset-0 flex flex-col items-center justify-center gap-6 overflow-hidden bg-ink px-6 text-center">
      <HideChrome />
      <MaintenanceLogo />
      <div>
        <p className="text-xs uppercase tracking-[0.3em] text-gold">Atoreum MV</p>
        <h1 className="mt-3 font-display text-2xl text-ivory md:text-3xl">We&apos;ll be back shortly.</h1>
        <p className="mt-2 max-w-sm text-sm leading-relaxed text-ivory-dim">
          The store is offline for maintenance right now. Please check back soon.
        </p>
      </div>
    </div>
  );
}
