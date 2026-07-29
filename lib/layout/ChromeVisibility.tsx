"use client";

import { createContext, useContext, useEffect, useState } from "react";

/**
 * Signals the storefront Header/Footer to hide themselves. Deliberately NOT
 * derived from usePathname() alone -- confirmed in testing that after a
 * Server Action's own redirect() (e.g. logout) lands on a page middleware
 * further redirects (e.g. into maintenance mode), Next.js's client-side
 * handling of that chain renders the final page's content correctly but
 * does not reliably update the browser's address bar or notify
 * usePathname() of the real destination. Header/Footer end up checking a
 * stale path and rendering when they shouldn't.
 *
 * Any page/layout that must hide the storefront chrome regardless of what
 * the URL bar happens to say mounts <HideChrome /> -- a real mount effect,
 * which fires correctly no matter how the client arrived there.
 */

const ChromeVisibilityContext = createContext<{
  hiddenCount: number;
  setHidden: (hidden: boolean) => void;
} | null>(null);

export function ChromeVisibilityProvider({ children }: { children: React.ReactNode }) {
  const [hiddenCount, setHiddenCount] = useState(0);
  const setHidden = (hidden: boolean) => setHiddenCount((n) => Math.max(0, n + (hidden ? 1 : -1)));
  return (
    <ChromeVisibilityContext.Provider value={{ hiddenCount, setHidden }}>
      {children}
    </ChromeVisibilityContext.Provider>
  );
}

/** True while any <HideChrome /> is mounted anywhere in the tree. */
export function useChromeHidden(): boolean {
  const ctx = useContext(ChromeVisibilityContext);
  return (ctx?.hiddenCount ?? 0) > 0;
}

export function HideChrome() {
  const ctx = useContext(ChromeVisibilityContext);
  useEffect(() => {
    if (!ctx) return;
    ctx.setHidden(true);
    return () => ctx.setHidden(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctx?.setHidden]);
  return null;
}
