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
  role: "customer" | "admin" | "superadmin" | null;
  /** Something happened they have not seen: an order moved, Sangu landed,
   *  today's dive is unplayed. Drives the dot on the profile icon. */
  hasUnseen: boolean;
  favorites: string[];
  /** Toggle a favorite; redirects to /login when signed out. */
  toggleFavorite: (productId: string) => void;
};

const SessionContext = createContext<SessionState>({
  loggedIn: null,
  hasUnseen: false,
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
  const [role, setRole] = useState<"customer" | "admin" | "superadmin" | null>(null);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [hasUnseen, setHasUnseen] = useState(false);
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
        setHasUnseen(Boolean(data.hasUnseen));
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
    <SessionContext.Provider value={{ loggedIn, name, role, hasUnseen, favorites, toggleFavorite }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  return useContext(SessionContext);
}
