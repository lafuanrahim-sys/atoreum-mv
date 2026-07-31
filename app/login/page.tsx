import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  loginAction,
  registerAction,
  requestPasswordResetAction,
  resendVerificationAction,
  resetPasswordAction,
} from "@/app/actions/auth";
import { getCurrentUser } from "@/lib/auth/currentUser.server";
import { isAdminRole } from "@/lib/auth/userSession";
import PageTransition from "@/components/ui/PageTransition";
import SubmitButton from "@/components/ui/SubmitButton";
import PasswordField from "@/components/ui/PasswordField";

export const metadata: Metadata = {
  title: "Sign in — Atoreum MV",
  description: "Sign in to your Atoreum MV account.",
};

const ERROR_MESSAGES: Record<string, string> = {
  credentials: "Incorrect email or password. Please try again.",
  invalid: "Please enter your name and a valid email address.",
  password: "Password must be at least 8 characters.",
  "password-mismatch": "Those passwords don't match.",
  exists: "An account with this email already exists. Try signing in instead.",
  unverified: "Please verify your email before signing in — check your inbox for the link.",
  "verify-failed": "That verification link is invalid or has expired. Request a new one below.",
  "reset-failed": "That reset link is invalid or has expired. Request a new one below.",
  "rate-limited": "Too many attempts. Please wait a few minutes and try again.",
};

const NOTICE_MESSAGES: Record<string, string> = {
  "verify-sent": "Check your inbox — we've sent a verification link.",
  "verify-send-failed": "Your account was created, but the verification email couldn't be sent. Try resending it below.",
  "reset-sent": "If an account exists for that email, we've sent a link to reset your password.",
};

/**
 * The one sign-in portal for both customers and admins — where you land
 * afterwards is decided by your account's role, not by which URL you used.
 * Four modes share this one route via ?mode=, rather than separate pages,
 * for the same reason login/register already did: one shell, one set of
 * error/notice plumbing, and mode switches crossfade instead of a full
 * navigation.
 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string; error?: string; notice?: string; email?: string; from?: string; token?: string }>;
}) {
  const { mode = "login", error = "", notice = "", email = "", from = "", token = "" } = await searchParams;
  const isRegister = mode === "register";
  const isForgot = mode === "forgot";
  const isReset = mode === "reset";
  const isTabbedMode = !isForgot && !isReset;

  // Already signed in? Straight to the right home.
  const user = await getCurrentUser();
  if (user) redirect(isAdminRole(user.role) ? "/dashboard" : "/account");

  const errorMessage = ERROR_MESSAGES[error];
  const noticeMessage = NOTICE_MESSAGES[notice];
  const needsResend = error === "unverified" || error === "verify-failed";
  const needsNewReset = error === "reset-failed";
  const modeHref = (m: string) =>
    `/login?mode=${m}${from ? `&from=${encodeURIComponent(from)}` : ""}`;

  const heading = isForgot ? "Reset your password" : isReset ? "Choose a new password" : isRegister ? "Create your account" : "Welcome back";
  const subtitle = isForgot
    ? "Enter your account email and we'll send you a link to reset your password."
    : isReset
      ? "Enter a new password for your account."
      : isRegister
        ? "Track your orders, keep favorites, and check out faster."
        : "Sign in to see your orders, favorites, and profile.";

  return (
    <div className="page-gutter flex min-h-[70vh] items-center justify-center bg-ink pb-24 pt-10 md:pt-14">
      <div className="card-entrance w-full max-w-md overflow-hidden rounded-2xl border border-ivory/15 bg-ink-2/60 bg-[linear-gradient(145deg,rgba(255,255,255,0.08),rgba(255,255,255,0)_55%)] p-8 shadow-[0_1px_0_0_rgba(255,255,255,0.08)_inset,0_25px_60px_-15px_rgba(0,0,0,0.5)] backdrop-blur-xl backdrop-saturate-150 md:p-10">
        <p className="text-xs uppercase tracking-[0.3em] text-gold">Atoreum MV</p>
        <h1 className="mt-3 font-display text-2xl text-ivory md:text-3xl">{heading}</h1>
        <p className="mt-2 text-sm leading-relaxed text-ivory-dim">{subtitle}</p>

        {isTabbedMode ? (
          <div className="mt-8 flex border-b border-line text-xs uppercase tracking-[0.2em]">
            <Link
              href={modeHref("login")}
              aria-current={!isRegister ? "page" : undefined}
              className={`px-4 pb-3 transition-colors active:scale-95 ${
                !isRegister ? "border-b border-gold text-gold" : "text-ivory-dim hover:text-gold"
              }`}
            >
              Sign In
            </Link>
            <Link
              href={modeHref("register")}
              aria-current={isRegister ? "page" : undefined}
              className={`px-4 pb-3 transition-colors active:scale-95 ${
                isRegister ? "border-b border-gold text-gold" : "text-ivory-dim hover:text-gold"
              }`}
            >
              Create Account
            </Link>
          </div>
        ) : (
          <Link
            href={modeHref("login")}
            className="mt-8 inline-block text-xs uppercase tracking-[0.2em] text-gold hover:underline"
          >
            ← Back to sign in
          </Link>
        )}

        {/* Keyed on mode so switching between modes crossfades (same route,
            only the ?mode= search param changes -- the route-level
            PageTransition in layout.tsx intentionally ignores
            search-param-only changes). */}
        <PageTransition transitionKey={mode}>
          <div>
            {errorMessage && (
              <p role="alert" className="fade-in-up mt-6 text-sm text-red-400">
                {errorMessage}
              </p>
            )}

            {noticeMessage && (
              <p role="status" className="fade-in-up mt-6 text-sm text-emerald-400">
                {noticeMessage}
              </p>
            )}

            {needsResend && (
              <form action={resendVerificationAction} className="mt-3">
                <input type="hidden" name="from" value={from} />
                <input type="hidden" name="email" value={email} />
                <button type="submit" className="text-xs uppercase tracking-[0.2em] text-gold hover:underline">
                  Resend verification email{email ? ` to ${email}` : ""}
                </button>
              </form>
            )}

            {needsNewReset && (
              <Link
                href={modeHref("forgot")}
                className="mt-3 inline-block text-xs uppercase tracking-[0.2em] text-gold hover:underline"
              >
                Request a new reset link
              </Link>
            )}

            {isForgot ? (
              <form action={requestPasswordResetAction} className="mt-6 flex flex-col gap-5">
                <label className="flex flex-col gap-2">
                  <span className="text-xs uppercase tracking-[0.15em] text-ivory-dim">Email</span>
                  <input
                    defaultValue={email}
                    type="email"
                    name="email"
                    required
                    autoComplete="email"
                    className="rounded-md border border-line bg-transparent px-4 py-3 text-sm text-ivory focus:border-gold focus:outline-none"
                  />
                </label>
                <SubmitButton variant="solid" className="mt-2 py-4" pendingLabel="Sending…">
                  Send reset link
                </SubmitButton>
              </form>
            ) : isReset ? (
              token ? (
                <form action={resetPasswordAction} className="mt-6 flex flex-col gap-5">
                  <input type="hidden" name="token" value={token} />
                  <label className="flex flex-col gap-2">
                    <span className="text-xs uppercase tracking-[0.15em] text-ivory-dim">New password (min 8 characters)</span>
                    <PasswordField name="password" required minLength={8} autoComplete="new-password" />
                  </label>
                  <label className="flex flex-col gap-2">
                    <span className="text-xs uppercase tracking-[0.15em] text-ivory-dim">Confirm new password</span>
                    <PasswordField name="confirmPassword" required minLength={8} autoComplete="new-password" />
                  </label>
                  <SubmitButton variant="solid" className="mt-2 py-4" pendingLabel="Resetting…">
                    Reset password
                  </SubmitButton>
                </form>
              ) : (
                <p className="mt-6 text-sm text-ivory-dim">
                  This link is missing its reset token.{" "}
                  <Link href={modeHref("forgot")} className="text-gold hover:underline">
                    Request a new one
                  </Link>
                  .
                </p>
              )
            ) : (
              <form action={isRegister ? registerAction : loginAction} className="mt-6 flex flex-col gap-5">
                <input type="hidden" name="from" value={from} />

                {isRegister && (
                  <label className="flex flex-col gap-2">
                    <span className="text-xs uppercase tracking-[0.15em] text-ivory-dim">Full name</span>
                    <input
                      type="text"
                      name="name"
                      required
                      autoComplete="name"
                      className="rounded-md border border-line bg-transparent px-4 py-3 text-sm text-ivory focus:border-gold focus:outline-none"
                    />
                  </label>
                )}

                <label className="flex flex-col gap-2">
                  <span className="text-xs uppercase tracking-[0.15em] text-ivory-dim">Email</span>
                  <input
                    defaultValue={email}
                    type="email"
                    name="email"
                    required
                    autoComplete="email"
                    className="rounded-md border border-line bg-transparent px-4 py-3 text-sm text-ivory focus:border-gold focus:outline-none"
                  />
                </label>

                <label className="flex flex-col gap-2">
                  <span className="text-xs uppercase tracking-[0.15em] text-ivory-dim">
                    Password{isRegister ? " (min 8 characters)" : ""}
                  </span>
                  <PasswordField
                    name="password"
                    required
                    minLength={isRegister ? 8 : undefined}
                    autoComplete={isRegister ? "new-password" : "current-password"}
                  />
                  {!isRegister && (
                    <Link
                      href={modeHref("forgot")}
                      className="self-end text-xs uppercase tracking-[0.15em] text-ivory-dim hover:text-gold hover:underline"
                    >
                      Forgot password?
                    </Link>
                  )}
                </label>

                <SubmitButton
                  variant="solid"
                  className="mt-2 py-4"
                  pendingLabel={isRegister ? "Creating account…" : "Signing in…"}
                >
                  {isRegister ? "Create Account" : "Sign In"}
                </SubmitButton>
              </form>
            )}
          </div>
        </PageTransition>
      </div>
    </div>
  );
}
