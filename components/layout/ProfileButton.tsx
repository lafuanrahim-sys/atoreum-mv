"use client";

import Link from "next/link";
import { useSession } from "@/lib/auth/SessionContext";

/**
 * Header profile icon. Signed out → /login; customers → /account;
 * admins → /dashboard. A small gold dot marks the signed-in state.
 */
export default function ProfileButton() {
  const { loggedIn, role, name } = useSession();

  const href = loggedIn ? (role === "admin" ? "/dashboard" : "/account") : "/login";
  const label = loggedIn ? `Account — ${name}` : "Sign in";

  return (
    <Link
      href={href}
      aria-label={label}
      title={label}
      className="relative flex h-9 w-9 items-center justify-center text-ivory-dim transition-colors hover:text-gold"
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-5 w-5">
        <circle cx="12" cy="8" r="3.5" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M5 19.5c1.2-3 4-4.5 7-4.5s5.8 1.5 7 4.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {loggedIn && (
        <span
          aria-hidden="true"
          className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-gold"
        />
      )}
    </Link>
  );
}
