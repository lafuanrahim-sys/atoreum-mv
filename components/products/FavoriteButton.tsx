"use client";

import { useRef, useState } from "react";
import { useSession } from "@/lib/auth/SessionContext";
import { cn } from "@/lib/utils";

/**
 * Heart toggle for a product. Signed out, tapping it routes to /login
 * (handled inside useSession.toggleFavorite).
 */
export default function FavoriteButton({
  productId,
  className,
}: {
  productId: string;
  className?: string;
}) {
  const { favorites, toggleFavorite } = useSession();
  const isFavorite = favorites.includes(productId);
  // Elastic pop, mobile only (max-md: below) -- a confirmation flourish for
  // the one-tap-to-favorite gesture that doesn't have a hover state to lean
  // on. Desktop's existing hover/color transition is untouched.
  const [justFavorited, setJustFavorited] = useState(false);
  const popTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!isFavorite) {
          setJustFavorited(true);
          if (popTimer.current) clearTimeout(popTimer.current);
          popTimer.current = setTimeout(() => setJustFavorited(false), 400);
        }
        toggleFavorite(productId);
      }}
      aria-label={isFavorite ? "Remove from favorites" : "Add to favorites"}
      aria-pressed={isFavorite}
      className={cn(
        "flex h-9 w-9 items-center justify-center rounded-full bg-ink/70 backdrop-blur-sm transition-colors",
        isFavorite ? "text-gold" : "text-ivory-dim hover:text-gold",
        justFavorited && "max-md:animate-heart-pop",
        className
      )}
    >
      <svg
        viewBox="0 0 24 24"
        fill={isFavorite ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth={1.5}
        className="h-4.5 w-4.5"
      >
        <path
          d="M12 20.5s-7.5-4.7-9.4-9.2C1.2 8 3 4.9 6.2 4.6c1.9-.2 3.7.8 4.7 2.3.2.3.7.3.9 0 1-1.5 2.9-2.5 4.8-2.3 3.2.3 5 3.4 3.6 6.7-1.9 4.5-8.2 9.2-8.2 9.2z"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}
