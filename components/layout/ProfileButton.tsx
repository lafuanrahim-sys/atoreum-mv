"use client";

import Link from "next/link";
import { useSession } from "@/lib/auth/SessionContext";

/**
 * Header profile icon. Signed out → /login; customers → /account;
 * admins → /dashboard. A small gold dot marks the signed-in state.
 */
export default function ProfileButton() {
  const { loggedIn, role, name, hasUnseen } = useSession();

  const href = loggedIn
    ? role === "admin" || role === "superadmin"
      ? "/dashboard"
      : "/account"
    : "/login";
  // Announced, not just drawn. A dot nobody can hear is not a notification
  // for anyone using a screen reader.
  const label = loggedIn
    ? hasUnseen
      ? `Account: ${name} — you have something new`
      : `Account: ${name}`
    : "Sign in";

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
      {/*
        The dot means "something is waiting", not "you are signed in".
        It marked the latter before, which made it permanent furniture: a badge
        that is always on is one nobody looks at, and it could never be used to
        say anything. Now it appears when an order moved, Sangu landed, or
        today's dive is unplayed, and opening the profile clears it.
      */}
      {loggedIn && hasUnseen && (
        <span
          aria-hidden="true"
          className="absolute right-0.5 top-0.5 flex h-2.5 w-2.5 items-center justify-center"
        >
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-gold opacity-60" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-gold" />
        </span>
      )}
    </Link>
  );
}
