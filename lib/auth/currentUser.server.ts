import { cookies } from "next/headers";
import { USER_SESSION_COOKIE, verifyUserSessionToken } from "@/lib/auth/userSession";
import { getUserById, type PublicUser } from "@/lib/data/users.server";

/**
 * Resolves the logged-in user (customer or admin) from the session cookie.
 * Returns null when logged out, the token is invalid/expired, or the user
 * record no longer exists. Role is read from the user record, not the token,
 * so a role change takes effect on the next request — not at next login.
 */
export async function getCurrentUser(): Promise<PublicUser | null> {
  const cookieStore = await cookies();
  const session = await verifyUserSessionToken(cookieStore.get(USER_SESSION_COOKIE)?.value);
  if (!session) return null;
  return getUserById(session.userId);
}
