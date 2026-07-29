"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import gsap from "gsap";
import { prefersReducedMotion } from "@/lib/motion";

/**
 * Crossfades content when its key changes, instead of an instant swap.
 * Holds the outgoing content's already-rendered children in local state
 * until the fade-out finishes, then swaps to the new (already-resolved)
 * children and fades those in -- the same "hold the old tree, swap under a
 * fade" trick AnimatePresence uses, done by hand since this project has no
 * framer-motion dependency (GSAP + Lenis only).
 *
 * The displayed content is always rendered under `key={key}` -- callers can
 * (and often do) swap in a structurally different tree under the same key
 * prop's owner (e.g. the login page's Sign In vs. Create Account forms,
 * where Create Account has an extra Full Name field shifting every field
 * after it). Without a distinct key, React's default reconciliation matches
 * up unrelated elements by position/type and can carry local state (e.g. a
 * password field's show/hide toggle) across the switch -- keying here once
 * makes every PageTransition usage safe against that by construction.
 *
 * Defaults to the route pathname as its key (route-change crossfade, used
 * in layout.tsx). Pass `transitionKey` to reuse the same mechanism for a
 * same-route content swap instead -- e.g. the login page's Sign In/Create
 * Account tabs or the account page's tab bar, both of which change via a
 * search param rather than a route change.
 */
export default function PageTransition({
  children,
  skipPrefixes,
  transitionKey,
}: {
  children: React.ReactNode;
  /** Skip the fade (swap instantly) when both the previous and next key
   * start with the same one of these prefixes -- for a route section that
   * already has its own nested, content-scoped PageTransition (see the
   * dashboard layout) so persistent chrome around it (the sidebar) never
   * re-fades on every click within that section. A plain string array
   * rather than a predicate function: this component is used from Server
   * Components, which can't pass closures across to a Client Component. */
  skipPrefixes?: string[];
  /** Overrides the default route-pathname key -- see above. */
  transitionKey?: string;
}) {
  const pathname = usePathname();
  const key = transitionKey ?? pathname;
  const [display, setDisplay] = useState({ key, children });
  const containerRef = useRef<HTMLDivElement | null>(null);
  const prevKey = useRef(key);

  useEffect(() => {
    if (prevKey.current === key) {
      // Same key -- e.g. only unrelated search params changed (filters,
      // pagination). Swap straight through, no fade; those updates already
      // animate themselves (ProductGrid's own reveal, etc).
      setDisplay({ key, children });
      return;
    }
    const from = prevKey.current;
    prevKey.current = key;

    if (skipPrefixes?.some((p) => from.startsWith(p) && key.startsWith(p))) {
      setDisplay({ key, children });
      return;
    }

    const el = containerRef.current;
    if (!el || prefersReducedMotion()) {
      setDisplay({ key, children });
      return;
    }

    gsap.to(el, {
      opacity: 0,
      duration: 0.18,
      ease: "power1.inOut",
      onComplete: () => {
        setDisplay({ key, children });
        gsap.fromTo(el, { opacity: 0 }, { opacity: 1, duration: 0.28, ease: "power1.out" });
      },
    });
  }, [key, children]);

  return (
    <div ref={containerRef}>
      <div key={display.key}>{display.children}</div>
    </div>
  );
}
