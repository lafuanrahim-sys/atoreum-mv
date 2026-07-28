"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useSession } from "@/lib/auth/SessionContext";

/**
 * Header balance chip — shell icon + live Boli balance, linking to the
 * account "Boli" tab. Renders nothing for guests, and nothing if the
 * balance can't be loaded (e.g. Boli not yet provisioned) rather than
 * showing a broken/zero state.
 */
export default function BoliChip() {
  const { loggedIn } = useSession();
  const [balance, setBalance] = useState<number | null>(null);

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
  }, [loggedIn]);

  if (!loggedIn || balance === null) return null;

  return (
    <Link
      href="/account?tab=boli"
      aria-label={`Boli balance: ${balance.toLocaleString()}`}
      title={`${balance.toLocaleString()} Boli`}
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
