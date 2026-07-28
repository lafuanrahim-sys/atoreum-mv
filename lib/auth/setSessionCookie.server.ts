import { cookies } from "next/headers";
import {
  USER_SESSION_COOKIE,
  USER_SESSION_MAX_AGE_SECONDS,
  createUserSessionToken,
  type UserRole,
} from "@/lib/auth/userSession";

/**
 * Shared by the login/register server actions and the email-verification
 * route handler. Deliberately NOT exported from app/actions/auth.ts (a
 * "use server" file) — every export there becomes a callable Server Action
 * endpoint, and this one takes a bare userId/role with no credential check,
 * so exposing it directly would let anyone log in as anyone.
 */
export async function setSessionCookie(userId: string, role: UserRole) {
  const cookieStore = await cookies();
  cookieStore.set(USER_SESSION_COOKIE, await createUserSessionToken(userId, role), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: USER_SESSION_MAX_AGE_SECONDS,
  });
}
