import Logo from "@/components/ui/Logo";
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
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-ink px-6 text-center">
      <HideChrome />
      <span className="h-10 w-10">
        <Logo />
      </span>
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
