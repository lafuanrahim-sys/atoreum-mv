"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { USER_SESSION_COOKIE, isAdminRole, type UserRole } from "@/lib/auth/userSession";
import {
  changeUserPassword,
  createUser,
  deleteUser,
  getUserById,
  issuePasswordResetToken,
  issueVerificationToken,
  resetPasswordWithToken,
  setUserRole,
  toggleUserFavorite,
  updateUserName,
  verifyCredentials,
} from "@/lib/data/users.server";
import { getCurrentUser } from "@/lib/auth/currentUser.server";
import { setSessionCookie } from "@/lib/auth/setSessionCookie.server";
import { sendPasswordResetEmail, sendVerificationEmail } from "@/lib/email";
import {
  checkLoginRateLimit,
  checkPasswordResetRateLimit,
  checkRegistrationRateLimit,
  checkResendVerificationRateLimit,
} from "@/lib/auth/rateLimit";

/** Origin to build absolute links (verification emails) against — derived from the request rather than a hardcoded env var, so it's correct in dev, staging, and prod without config. */
async function getBaseUrl(): Promise<string> {
  const h = await headers();
  const host = h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (process.env.NODE_ENV === "production" ? "https" : "http");
  return `${proto}://${host}`;
}

// No CDN/reverse-proxy of record for this deployment — best-effort only,
// same as the identical helper in app/api/boli/dive/play/route.ts (that one
// reads from a NextRequest directly; Server Actions only have headers()).
async function clientIp(): Promise<string> {
  const forwarded = (await headers()).get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || "unknown";
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

  const rateLimit = checkLoginRateLimit(email, await clientIp());
  if (!rateLimit.ok) {
    loginRedirect({ error: "rate-limited", mode: "login", ...(from ? { from } : {}) });
  }

  const user = await verifyCredentials(email, password);
  if (!user) {
    loginRedirect({ error: "credentials", mode: "login", ...(from ? { from } : {}) });
  }
  if (!user.emailVerified) {
    loginRedirect({ error: "unverified", mode: "login", email: user.email, ...(from ? { from } : {}) });
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
  if (!checkRegistrationRateLimit(await clientIp()).ok) {
    loginRedirect({ error: "rate-limited", mode: "register", ...(from ? { from } : {}) });
  }

  const result = await createUser({ name, email, password });
  if ("error" in result) {
    loginRedirect({ error: "exists", mode: "register", ...(from ? { from } : {}) });
  }

  // Signed up, not signed in yet — the account can't log in until the
  // verification link is clicked (see loginAction's emailVerified check),
  // so there's no session to start here.
  const verifyUrl = `${await getBaseUrl()}/api/verify-email?token=${result.verificationToken}`;
  const sendResult = await sendVerificationEmail({
    to: result.user.email,
    name: result.user.name,
    verifyUrl,
  });
  if ("error" in sendResult) console.error("Verification email failed to send:", sendResult.error);

  loginRedirect({
    mode: "login",
    // Account exists either way — a flaky send shouldn't strand the
    // signup, they can request a new link from the sign-in screen.
    notice: "error" in sendResult ? "verify-send-failed" : "verify-sent",
    email: result.user.email,
    ...(from ? { from } : {}),
  });
}

/** Re-sends the verification email for an account that hasn't clicked its link yet (original lost or expired). */
export async function resendVerificationAction(formData: FormData): Promise<void> {
  const email = String(formData.get("email") ?? "");
  const from = String(formData.get("from") ?? "");

  // Unauthenticated and, unlike registration, not even limited by needing a
  // fresh email each time — capped per target address (not per requester)
  // so this can't be looped to flood one inbox. Silently skips the actual
  // send rather than surfacing a distinct error: same reasoning as the
  // account-enumeration protection below, this shouldn't tell a caller
  // anything about the target beyond "an email may or may not have gone
  // out" (a legitimate user hitting this is rare and can just wait).
  if (checkResendVerificationRateLimit(email).ok) {
    const result = await issueVerificationToken(email);
    if (!("error" in result)) {
      const verifyUrl = `${await getBaseUrl()}/api/verify-email?token=${result.verificationToken}`;
      const sendResult = await sendVerificationEmail({ to: result.user.email, name: result.user.name, verifyUrl });
      if ("error" in sendResult) console.error("Verification email failed to send:", sendResult.error);
    }
  }
  // Same response whether the account doesn't exist, is already verified,
  // the resend just went out, or it was silently rate-limited — no reason
  // to hand out account-existence (or rate-limit) info from a public form.
  loginRedirect({ mode: "login", notice: "verify-sent", email, ...(from ? { from } : {}) });
}

/** Public: "Forgot password?" form on the login page. Same account-enumeration posture as resendVerificationAction — the response never reveals whether the address had an account. */
export async function requestPasswordResetAction(formData: FormData): Promise<void> {
  const email = String(formData.get("email") ?? "");

  if (checkPasswordResetRateLimit(email).ok) {
    const result = await issuePasswordResetToken(email);
    if (!("error" in result)) {
      const resetUrl = `${await getBaseUrl()}/login?mode=reset&token=${result.resetToken}`;
      const sendResult = await sendPasswordResetEmail({ to: result.user.email, name: result.user.name, resetUrl });
      if ("error" in sendResult) console.error("Password reset email failed to send:", sendResult.error);
    }
  }
  loginRedirect({ mode: "login", notice: "reset-sent" });
}

/** Public: destination of the "Reset password" link in the email — sets the new password and signs the user straight in, since typing a new password for a token only they received already proves both intent and ownership. */
export async function resetPasswordAction(formData: FormData): Promise<void> {
  const token = String(formData.get("token") ?? "");
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  const withToken = (params: Record<string, string>) =>
    loginRedirect({ mode: "reset", token, ...params });

  if (!token) loginRedirect({ mode: "login", error: "reset-failed" });
  if (password.length < 8) withToken({ error: "password" });
  if (password !== confirmPassword) withToken({ error: "password-mismatch" });

  const result = await resetPasswordWithToken(token, password);
  if ("error" in result) loginRedirect({ mode: "login", error: "reset-failed" });

  await setSessionCookie(result.id, result.role);
  redirect(homeFor(result.role));
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

  await updateUserName(user.id, name);
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

  const result = await changeUserPassword(user.id, current, next);
  if ("error" in result) redirect(withParam("password=wrong"));

  redirect(withParam("password=changed"));
}

/** Toggle a product in the current user's favorites; returns the new list. */
export async function toggleFavoriteAction(productId: string): Promise<string[] | { error: string }> {
  const user = await getCurrentUser();
  if (!user) return { error: "not-logged-in" };

  const favorites = await toggleUserFavorite(user.id, productId);
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

  await setUserRole(userId, role);
  revalidatePath("/dashboard/customers");
}

/** Super-admin only: permanently delete a user account (never the super admin's own). */
export async function deleteUserAction(userId: string): Promise<void> {
  const actor = await getCurrentUser();
  if (!actor || actor.role !== "superadmin") redirect("/login");
  if (actor.id === userId) return;

  await deleteUser(userId);
  revalidatePath("/dashboard/customers");
  revalidatePath("/dashboard");
}

/**
 * Super-admin only: sends a customer or admin a password-reset email on
 * their behalf (e.g. a locked-out customer who calls support) — the same
 * token/email flow as the public "forgot password" form, so the admin never
 * sees or sets the account's actual password. Bound directly to an
 * AdminActionButton, not a form submit, so failures throw for its toast
 * rather than redirecting.
 */
export async function adminSendPasswordResetAction(userId: string): Promise<void> {
  const actor = await getCurrentUser();
  if (!actor || actor.role !== "superadmin") redirect("/login");

  const target = await getUserById(userId);
  if (!target) throw new Error("Account not found.");

  const result = await issuePasswordResetToken(target.email);
  if ("error" in result) throw new Error(result.error);

  const resetUrl = `${await getBaseUrl()}/login?mode=reset&token=${result.resetToken}`;
  const sendResult = await sendPasswordResetEmail({ to: result.user.email, name: result.user.name, resetUrl });
  if ("error" in sendResult) throw new Error("Couldn't send the reset email — try again.");
}
