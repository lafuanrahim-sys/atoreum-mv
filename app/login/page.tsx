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
  title: "Sign in",
  // Belt and braces alongside app/robots.ts. A crawler that reaches this
  // page anyway -- from a pasted link, say -- is told plainly not to index it.
  robots: { index: false, follow: false },
  description: "Sign in to your Atoreum MV account.",
};

const ERROR_MESSAGES: Record<string, string> = {
  credentials: "Incorrect email or password. Please try again.",
  invalid: "Please enter your name and a valid email address.",
  password: "Password must be at least 8 characters.",
  "password-mismatch": "Those passwords don't match.",
  exists: "An account with this email already exists. Try signing in instead.",
  unverified: "Please verify your email before signing in. Check your inbox for the link.",
  "verify-failed": "That verification link is invalid or has expired. Request a new one below.",
  "reset-failed": "That reset link is invalid or has expired. Request a new one below.",
  "rate-limited": "Too many attempts. Please wait a few minutes and try again.",
};

/**
 * Notices are a headline and a detail, not one grey sentence.
 *
 * These were a single line of small green text under the form, and people
 * missed them: they registered, saw nothing they recognised as a response,
 * and either tried again or gave up waiting for an email they did not know
 * had been sent. The most important message on the page was also the quietest
 * thing on it.
 *
 * The headline says what happened; the detail says what to do next, including
 * the part everyone forgets to check.
 */
const NOTICE_MESSAGES: Record<string, { title: string; detail: string; tone: "good" | "warn" }> = {
  "verify-sent": {
    title: "Check your email",
    detail:
      "We have sent you a verification link. Open it to finish creating your account. If it is not in your inbox within a minute or two, look in your spam or junk folder.",
    tone: "good",
  },
  "verify-send-failed": {
    title: "Account created, but the email did not send",
    detail: "Your account exists. Use the resend button below to try the verification email again.",
    tone: "warn",
  },
  "reset-sent": {
    title: "Check your email",
    detail:
      "If an account exists for that address, we have sent a link to reset your password. It may take a minute to arrive, and it is worth checking your spam or junk folder.",
    tone: "good",
  },
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

  // Relief lives in globals.css (see the "Relief" block there), driven by
  // theme-scoped tokens rather than fixed rgba. That indirection is the whole
  // point: the first pass hardcoded a 40%-black rim and a 30%-black top wash,
  // which read as a crisp recess on the near-black dark theme and as a dirty
  // grey smear across a white card in the light one. Relief is relative to
  // the surface it sits on, so it has to move with the palette.
  const CARD_DEBOSS = "relief-recess";
  const FIELD_RAISED = "relief-raised";
  const BUTTON_RAISED = "relief-raised-strong";

  return (
    <div className="bg-ink">
      {/* Exactly the viewport minus the fixed header's own reserved space
          (main's pt-24/md:pt-28, 6rem/7rem) -- not min-h-[75vh] + its own
          pt/pb, which left the page taller than one screen and scrollable.
          svh (not vh/dvh) is deliberate: it's pinned to the *smallest*
          possible mobile viewport (toolbar fully expanded), so content
          sized against it can never overflow into a scrollbar when the
          toolbar shows/hides -- the same reasoning already used for the
          h-100svh sections elsewhere in this codebase. justify-center then
          centers the card in that exact space on any screen, desktop or
          mobile, with nothing left over to scroll. */}
      <div className="page-gutter flex h-[calc(100svh-6rem)] flex-col items-center justify-center gap-10 md:h-[calc(100svh-7rem)]">
        {/* The fill is darker than the page and darkest at the top, which is
            what a recess looks like: the upper wall shades its own floor. It
            replaces a lighter-than-the-page glass panel lit from the top-left
            -- that gradient was the emboss, and leaving it in would have
            fought every shadow below it.

            backdrop-blur is gone with it. The page behind this card is a flat
            --ink fill, so there was never anything to blur; it only ever cost
            a compositor layer, and a recess is not a pane of glass anyway. */}
        <div
          className={`card-entrance w-full max-w-md overflow-hidden rounded-2xl p-8 ${CARD_DEBOSS} md:p-10`}
        >
        <h1 className="font-display text-2xl text-ivory md:text-3xl">{heading}</h1>
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
              <div
                role="alert"
                className="fade-in-up mt-6 flex items-start gap-3 rounded-md border border-red-400/40 bg-red-400/[0.08] p-4"
              >
                <svg viewBox="0 0 20 20" aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-red-400">
                  <circle cx="10" cy="10" r="7.5" fill="none" stroke="currentColor" strokeWidth="1.3" />
                  <path d="M10 6v5M10 13.5v.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                </svg>
                <p className="text-sm leading-relaxed text-red-300">{errorMessage}</p>
              </div>
            )}

            {/* A bordered, tinted panel with an icon, because this is the one
                thing on the page the customer most needs to notice, and it was
                previously the least noticeable thing on it. */}
            {noticeMessage && (
              <div
                role="status"
                aria-live="polite"
                className={`fade-in-up mt-6 flex items-start gap-3 rounded-md border p-4 ${
                  noticeMessage.tone === "good"
                    ? "border-emerald-500/40 bg-emerald-500/[0.08]"
                    : "border-gold/40 bg-gold/[0.08]"
                }`}
              >
                <svg
                  viewBox="0 0 20 20"
                  aria-hidden="true"
                  className={`mt-0.5 h-5 w-5 shrink-0 ${
                    noticeMessage.tone === "good" ? "text-emerald-400" : "text-gold"
                  }`}
                >
                  <rect x="2.5" y="4.5" width="15" height="11" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.3" />
                  <path d="M3 5.5l7 5 7-5" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <div>
                  <p
                    className={`text-sm font-medium ${
                      noticeMessage.tone === "good" ? "text-emerald-300" : "text-gold"
                    }`}
                  >
                    {noticeMessage.title}
                  </p>
                  <p className="mt-1 text-[13px] leading-relaxed text-ivory-dim">{noticeMessage.detail}</p>
                </div>
              </div>
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
                    className={`rounded-md border border-line px-4 py-3 text-sm text-ivory focus:border-gold focus:outline-none ${FIELD_RAISED}`}
                  />
                </label>
                <SubmitButton variant="solid" className={`mt-2 py-4 ${BUTTON_RAISED}`} pendingLabel="Sending…">
                  Send reset link
                </SubmitButton>
              </form>
            ) : isReset ? (
              token ? (
                <form action={resetPasswordAction} className="mt-6 flex flex-col gap-5">
                  <input type="hidden" name="token" value={token} />
                  <label className="flex flex-col gap-2">
                    <span className="text-xs uppercase tracking-[0.15em] text-ivory-dim">New password (min 8 characters)</span>
                    <PasswordField name="password" required minLength={8} autoComplete="new-password" className={FIELD_RAISED} />
                  </label>
                  <label className="flex flex-col gap-2">
                    <span className="text-xs uppercase tracking-[0.15em] text-ivory-dim">Confirm new password</span>
                    <PasswordField name="confirmPassword" required minLength={8} autoComplete="new-password" className={FIELD_RAISED} />
                  </label>
                  <SubmitButton variant="solid" className={`mt-2 py-4 ${BUTTON_RAISED}`} pendingLabel="Resetting…">
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
                      className={`rounded-md border border-line px-4 py-3 text-sm text-ivory focus:border-gold focus:outline-none ${FIELD_RAISED}`}
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
                    className={`rounded-md border border-line px-4 py-3 text-sm text-ivory focus:border-gold focus:outline-none ${FIELD_RAISED}`}
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
                    className={FIELD_RAISED}
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
                  className={`mt-2 py-4 ${BUTTON_RAISED}`}
                  pendingLabel={isRegister ? "Creating account…" : "Signing in…"}
                >
                  {isRegister ? "Create Account" : "Sign In"}
                </SubmitButton>
              </form>
            )}
          </div>
        </PageTransition>
        </div>

        {/* Replaces what the footer would otherwise have said here (Malé,
            Maldives) -- a real coordinate, not a decorative flourish, so the
            page still grounds itself in an actual place even without the
            site chrome around it. */}
        <p className="text-center text-[10px] uppercase tracking-[0.3em] text-ivory-dim/50">
          Malé, Maldives · 4°10&prime;N 73°30&prime;E
        </p>
      </div>
    </div>
  );
}
