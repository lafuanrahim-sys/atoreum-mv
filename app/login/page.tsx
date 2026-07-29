import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { loginAction, registerAction, resendVerificationAction } from "@/app/actions/auth";
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
  exists: "An account with this email already exists. Try signing in instead.",
  unverified: "Please verify your email before signing in — check your inbox for the link.",
  "verify-failed": "That verification link is invalid or has expired. Request a new one below.",
};

const NOTICE_MESSAGES: Record<string, string> = {
  "verify-sent": "Check your inbox — we've sent a verification link.",
  "verify-send-failed": "Your account was created, but the verification email couldn't be sent. Try resending it below.",
};

/**
 * The one sign-in portal for both customers and admins — where you land
 * afterwards is decided by your account's role, not by which URL you used.
 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string; error?: string; notice?: string; email?: string; from?: string }>;
}) {
  const { mode = "login", error = "", notice = "", email = "", from = "" } = await searchParams;
  const isRegister = mode === "register";

  // Already signed in? Straight to the right home.
  const user = await getCurrentUser();
  if (user) redirect(isAdminRole(user.role) ? "/dashboard" : "/account");

  const errorMessage = ERROR_MESSAGES[error];
  const noticeMessage = NOTICE_MESSAGES[notice];
  const needsResend = error === "unverified" || error === "verify-failed";
  const modeHref = (m: string) =>
    `/login?mode=${m}${from ? `&from=${encodeURIComponent(from)}` : ""}`;

  return (
    <div className="page-gutter flex min-h-[70vh] items-center justify-center bg-ink pb-24 pt-10 md:pt-14">
      <div className="card-entrance w-full max-w-md border border-line p-8 md:p-10">
        <p className="text-xs uppercase tracking-[0.3em] text-gold">Atoreum MV</p>
        <h1 className="mt-3 font-display text-2xl text-ivory md:text-3xl">
          {isRegister ? "Create your account" : "Welcome back"}
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-ivory-dim">
          {isRegister
            ? "Track your orders, keep favorites, and check out faster."
            : "Sign in to see your orders, favorites, and profile."}
        </p>

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

        {/* Keyed on mode so switching Sign In <-> Create Account crossfades
            (same route, only the ?mode= search param changes -- the
            route-level PageTransition in layout.tsx intentionally ignores
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
                    className="border border-line bg-transparent px-4 py-3 text-sm text-ivory focus:border-gold focus:outline-none"
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
                  className="border border-line bg-transparent px-4 py-3 text-sm text-ivory focus:border-gold focus:outline-none"
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
              </label>

              <SubmitButton
                variant="solid"
                className="mt-2 py-4"
                pendingLabel={isRegister ? "Creating account…" : "Signing in…"}
              >
                {isRegister ? "Create Account" : "Sign In"}
              </SubmitButton>
            </form>
          </div>
        </PageTransition>
      </div>
    </div>
  );
}
