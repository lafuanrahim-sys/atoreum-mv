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
      {/* A spiral shell, for sangu — the conch. The previous mark was an oval
          with a vertical slit, which is specifically a COWRIE, and stopped
          being right the moment the currency was renamed from Boli (cowrie)
          to Sangu (conch).

          A literal conch was tried first and abandoned: its identifying
          features are the spire, the whorls and the flared aperture, none of
          which survive at the 16px this renders at — the drawings read as a
          leaf or a scribble. A spiral is what a shell reduces to at icon
          size, and it stays unambiguous. The stroke is heavier than the rest
          of the header's icons on purpose; at 1.4 the inner curl closed up
          into a blob. */}
      <svg viewBox="0 0 20 20" aria-hidden="true" className="h-4 w-4 shrink-0">
        <path
          d="M16.8 10a6.8 6.8 0 1 1-6.8-6.8 5.2 5.2 0 0 1 5.2 5.2 3.9 3.9 0 0 1-3.9 3.9 2.9 2.9 0 0 1-2.9-2.9 2.1 2.1 0 0 1 2.1-2.1"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.9"
          strokeLinecap="round"
        />
      </svg>
      <span className="text-xs tabular-nums">{balance.toLocaleString()}</span>
    </Link>
  );
}
