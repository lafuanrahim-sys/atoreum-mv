"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { useSession } from "@/lib/auth/SessionContext";

/**
 * Header balance chip — shell icon + live Sangu balance, linking to the
 * account "Sangu" tab. Renders nothing for guests, and nothing if the
 * balance can't be loaded (e.g. Sangu not yet provisioned) rather than
 * showing a broken/zero state.
 *
 * Refetches on pathname/searchParams change and on window focus, not just
 * once on mount — this chip lives in the root layout, which stays mounted
 * across every client-side navigation in the app (unlike the account
 * page's own Sangu balance display, a Server Component that does refetch on
 * navigation). Without this, the number here froze at whatever it was on
 * first load: playing Sangu Dive (a searchParams-only change on /account,
 * ?boliView=dive -> ?boliView=my) or completing a checkout that redeems/
 * earns Sangu left this chip showing the pre-play balance until a full page
 * reload remounted it — reported as "have to restart the page" to see an
 * updated balance.
 */
export default function BoliChip() {
  const { loggedIn } = useSession();
  const [balance, setBalance] = useState<number | null>(null);
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const searchParamsKey = searchParams.toString();

  const refetch = useCallback(() => {
    fetch("/api/boli/balance")
      .then((res) => res.json())
      .then((data) => setBalance(typeof data.balance === "number" ? data.balance : null))
      .catch(() => setBalance(null));
  }, []);

  useEffect(() => {
    if (!loggedIn) {
      setBalance(null);
      return;
    }
    let cancelled = false;
    fetch("/api/boli/balance")
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) setBalance(typeof data.balance === "number" ? data.balance : null);
      })
      .catch(() => {
        if (!cancelled) setBalance(null);
      });
    return () => {
      cancelled = true;
    };
  }, [loggedIn, pathname, searchParamsKey]);

  // Belt-and-suspenders on top of the pathname/searchParams effect above —
  // catches cases that aren't a distinct client-side navigation, like
  // switching back to this tab after playing in another one, or a Server
  // Action redirect chain (checkout) that doesn't always land on a URL
  // different enough to re-trigger the effect above.
  useEffect(() => {
    if (!loggedIn) return;
    const onVisible = () => {
      if (document.visibilityState === "visible") refetch();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", refetch);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", refetch);
    };
  }, [loggedIn, refetch]);

  if (!loggedIn || balance === null) return null;

  return (
    <Link
      href="/account?tab=boli"
      aria-label={`Sangu balance: ${balance.toLocaleString()}`}
      title={`${balance.toLocaleString()} Sangu`}
      className="flex h-9 items-center gap-1.5 px-1.5 text-ivory-dim transition-colors hover:text-gold"
    >
      <svg viewBox="0 0 20 20" aria-hidden="true" className="h-4 w-4 shrink-0">
        <path
          d="M10 2.5c4 0 6.5 4 6.5 8s-2.5 7-6.5 7-6.5-3-6.5-7 2.5-8 6.5-8Z"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinejoin="round"
        />
        <path d="M10 6.5v7" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      </svg>
      <span className="text-xs tabular-nums">{balance.toLocaleString()}</span>
    </Link>
  );
}
