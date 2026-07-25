"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  USER_SESSION_COOKIE,
  USER_SESSION_MAX_AGE_SECONDS,
  createUserSessionToken,
  isAdminRole,
  type UserRole,
} from "@/lib/auth/userSession";
import {
  changeUserPassword,
  createUser,
  deleteUser,
  setUserRole,
  toggleUserFavorite,
  updateUserName,
  verifyCredentials,
} from "@/lib/data/users.server";
import { getCurrentUser } from "@/lib/auth/currentUser.server";

async function setSessionCookie(userId: string, role: UserRole) {
  const cookieStore = await cookies();
  cookieStore.set(USER_SESSION_COOKIE, await createUserSessionToken(userId, role), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: USER_SESSION_MAX_AGE_SECONDS,
  });
}

function loginRedirect(params: Record<string, string>): never {
  const search = new URLSearchParams(params).toString();
  redirect(`/login${search ? `?${search}` : ""}`);
}

/** Where each role lands after signing in (unless a safe `from` is given). */
function homeFor(role: UserRole): string {
  return isAdminRole(role) ? "/dashboard" : "/account";
}

export async function loginAction(formData: FormData): Promise<void> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const from = String(formData.get("from") ?? "");

  const user = verifyCredentials(email, password);
  if (!user) {
    loginRedirect({ error: "credentials", mode: "login", ...(from ? { from } : {}) });
  }

  await setSessionCookie(user.id, user.role);

  // Only follow same-site paths, and never send a customer into the
  // admin-only dashboard (middleware would bounce them back to /login,
  // reading as a broken login).
  const safeFrom =
    from.startsWith("/") && !from.startsWith("//") && !(from.startsWith("/dashboard") && !isAdminRole(user.role))
      ? from
      : null;
  redirect(safeFrom ?? homeFor(user.role));
}

export async function registerAction(formData: FormData): Promise<void> {
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const from = String(formData.get("from") ?? "");

  if (!name || !email || !email.includes("@")) {
    loginRedirect({ error: "invalid", mode: "register", ...(from ? { from } : {}) });
  }
  if (password.length < 8) {
    loginRedirect({ error: "password", mode: "register", ...(from ? { from } : {}) });
  }

  const result = createUser({ name, email, password });
  if ("error" in result) {
    loginRedirect({ error: "exists", mode: "register", ...(from ? { from } : {}) });
  }

  await setSessionCookie(result.id, result.role);
  const safeFrom = from.startsWith("/") && !from.startsWith("//") && !from.startsWith("/dashboard") ? from : null;
  redirect(safeFrom ?? "/account");
}

export async function logoutAction(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(USER_SESSION_COOKIE);
  redirect("/");
}

export async function updateProfileAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const name = String(formData.get("name") ?? "").trim();
  const back = String(formData.get("back") ?? "/account?tab=profile");
  const withParam = (param: string) => `${back}${back.includes("?") ? "&" : "?"}${param}`;
  if (!name) redirect(withParam("profile=invalid"));

  updateUserName(user.id, name);
  revalidatePath("/account");
  revalidatePath("/dashboard/profile");
  redirect(withParam("profile=saved"));
}

export async function changePasswordAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const current = String(formData.get("currentPassword") ?? "");
  const next = String(formData.get("newPassword") ?? "");
  const back = String(formData.get("back") ?? "/account?tab=profile");
  const withParam = (param: string) => `${back}${back.includes("?") ? "&" : "?"}${param}`;

  if (next.length < 8) redirect(withParam("password=short"));

  const result = changeUserPassword(user.id, current, next);
  if ("error" in result) redirect(withParam("password=wrong"));

  redirect(withParam("password=changed"));
}

/** Toggle a product in the current user's favorites; returns the new list. */
export async function toggleFavoriteAction(productId: string): Promise<string[] | { error: string }> {
  const user = await getCurrentUser();
  if (!user) return { error: "not-logged-in" };

  const favorites = toggleUserFavorite(user.id, productId);
  revalidatePath("/account");
  return favorites ?? { error: "not-found" };
}

/**
 * Super-admin only: grant or revoke the admin role. Regular admins can see
 * the customer list but may not touch roles; the store itself additionally
 * refuses to ever change the super admin's own role.
 */
export async function assignRoleAction(userId: string, role: "customer" | "admin"): Promise<void> {
  const actor = await getCurrentUser();
  if (!actor || actor.role !== "superadmin") redirect("/login");
  if (actor.id === userId) return;

  setUserRole(userId, role);
  revalidatePath("/dashboard/customers");
}

/** Super-admin only: permanently delete a user account (never the super admin's own). */
export async function deleteUserAction(userId: string): Promise<void> {
  const actor = await getCurrentUser();
  if (!actor || actor.role !== "superadmin") redirect("/login");
  if (actor.id === userId) return;

  deleteUser(userId);
  revalidatePath("/dashboard/customers");
  revalidatePath("/dashboard");
}
