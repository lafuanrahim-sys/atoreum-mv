"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

/**
 * A back control that actually goes back where the visitor came from, with a
 * sensible destination when there is no "back" to go to.
 *
 * Renders a real <Link> to `fallbackHref`, so it works before hydration and
 * with JavaScript off. Once mounted, if the referrer shows the visitor
 * arrived from somewhere on this site, the click is intercepted and turned
 * into a history back() instead — which returns them to the exact tab and
 * scroll position they left, something a fixed href can't do.
 *
 * The referrer check matters: this page is reachable from the account area
 * but also directly (a bookmark, a search result, a shared link). Blindly
 * calling back() for those visitors either does nothing or throws them out
 * of the site entirely, and blindly linking to the account area sends a
 * logged-out reader to a login screen they didn't ask for.
 */
export default function BackLink({
  fallbackHref,
  label,
  className,
}: {
  fallbackHref: string;
  label: string;
  className?: string;
}) {
  const router = useRouter();
  const [cameFromThisSite, setCameFromThisSite] = useState(false);

  useEffect(() => {
    try {
      const ref = document.referrer;
      setCameFromThisSite(Boolean(ref) && new URL(ref).origin === window.location.origin);
    } catch {
      setCameFromThisSite(false);
    }
  }, []);

  return (
    <Link
      href={fallbackHref}
      onClick={(e) => {
        if (!cameFromThisSite) return; // let the plain navigation happen
        e.preventDefault();
        router.back();
      }}
      className={className ?? "text-xs uppercase tracking-[0.2em] text-ivory-dim transition-colors hover:text-gold"}
    >
      ← {label}
    </Link>
  );
}
