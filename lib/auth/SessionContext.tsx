"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import { toggleFavoriteAction } from "@/app/actions/auth";

type SessionState = {
  /** null = still loading (unknown). */
  loggedIn: boolean | null;
  name: string;
  role: "customer" | "admin" | null;
  favorites: string[];
  /** Toggle a favorite; redirects to /login when signed out. */
  toggleFavorite: (productId: string) => void;
};

const SessionContext = createContext<SessionState>({
  loggedIn: null,
  name: "",
  role: null,
  favorites: [],
  toggleFavorite: () => {},
});

/**
 * Client-side mirror of the signed-in session (via /api/me) for UI that
 * lives in client components: the header profile icon and favorite hearts.
 * Refetches on route change so signing in/out reflects without a reload.
 */
export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [loggedIn, setLoggedIn] = useState<boolean | null>(null);
  const [name, setName] = useState("");
  const [role, setRole] = useState<"customer" | "admin" | null>(null);
  const [favorites, setFavorites] = useState<string[]>([]);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    let cancelled = false;
    fetch("/api/me")
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        setLoggedIn(Boolean(data.loggedIn));
        setName(data.name ?? "");
        setRole(data.role ?? null);
        setFavorites(Array.isArray(data.favorites) ? data.favorites : []);
      })
      .catch(() => {
        if (!cancelled) setLoggedIn(false);
      });
    return () => {
      cancelled = true;
    };
  }, [pathname]);

  const toggleFavorite = useCallback(
    (productId: string) => {
      if (!loggedIn) {
        router.push(`/login?from=${encodeURIComponent(pathname)}`);
        return;
      }
      // Optimistic flip; reconciled with the server's answer below.
      setFavorites((prev) =>
        prev.includes(productId) ? prev.filter((f) => f !== productId) : [...prev, productId]
      );
      toggleFavoriteAction(productId).then((result) => {
        if (Array.isArray(result)) setFavorites(result);
      });
    },
    [loggedIn, pathname, router]
  );

  return (
    <SessionContext.Provider value={{ loggedIn, name, role, favorites, toggleFavorite }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  return useContext(SessionContext);
}
