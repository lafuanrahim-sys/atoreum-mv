"use client";

import { useEffect } from "react";
import { useSession } from "@/lib/auth/SessionContext";

const STORAGE_KEY = "atoreum_recently_viewed";
const MAX_ENTRIES = 8;

/**
 * Renders nothing — records this product id in localStorage so the
 * Collections page can surface a "Recently viewed" strip. Signed-out
 * only: tied to the account, not the browser, so a guest doesn't build up
 * (or leak, on a shared device) history that isn't theirs. `loggedIn` is
 * null while the session is still resolving; wait for a definite true
 * rather than writing speculatively.
 */
export default function TrackRecentlyViewed({ productId }: { productId: string }) {
  const { loggedIn } = useSession();

  useEffect(() => {
    if (!loggedIn) return;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      const ids: string[] = raw ? JSON.parse(raw) : [];
      const next = [productId, ...ids.filter((id) => id !== productId)].slice(0, MAX_ENTRIES);
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Private-browsing / storage-disabled — recently-viewed is a nice-to-have, fail silent.
    }
  }, [productId, loggedIn]);

  return null;
}
