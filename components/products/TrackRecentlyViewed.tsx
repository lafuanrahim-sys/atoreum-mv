"use client";

import { useEffect } from "react";

const STORAGE_KEY = "atoreum_recently_viewed";
const MAX_ENTRIES = 8;

/** Renders nothing — records this product id in localStorage so the Collections page can surface a "Recently viewed" strip. */
export default function TrackRecentlyViewed({ productId }: { productId: string }) {
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      const ids: string[] = raw ? JSON.parse(raw) : [];
      const next = [productId, ...ids.filter((id) => id !== productId)].slice(0, MAX_ENTRIES);
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Private-browsing / storage-disabled — recently-viewed is a nice-to-have, fail silent.
    }
  }, [productId]);

  return null;
}
