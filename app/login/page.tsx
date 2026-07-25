import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { loginAction, registerAction } from "@/app/actions/auth";
import { getCurrentUser } from "@/lib/auth/currentUser.server";
import { isAdminRole } from "@/lib/auth/userSession";

export const metadata: Metadata = {
  title: "Sign in — Atoreum MV",
  description: "Sign in to your Atoreum MV account.",
};

const ERROR_MESSAGES: Record<string, string> = {
  credentials: "Incorrect email or password. Please try again.",
  invalid: "Please enter your name and a valid email address.",
  password: "Password must be at least 8 characters.",
  exists: "An account with this email already exists. Try signing in instead.",
};

/**
 * The one sign-in portal for both customers and admins — where you land
 * afterwards is decided by your account's role, not by which URL you used.
 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string; error?: string; from?: string }>;
}) {
  const { mode = "login", error = "", from = "" } = await searchParams;
  const isRegister = mode === "register";

  // Already signed in? Straight to the right home.
  const user = await getCurrentUser();
  if (user) redirect(isAdminRole(user.role) ? "/dashboard" : "/account");

  const errorMessage = ERROR_MESSAGES[error];
  const modeHref = (m: string) =>
    `/login?mode=${m}${from ? `&from=${encodeURIComponent(from)}` : ""}`;

  return (
    <div className="page-gutter flex min-h-[70vh] items-center justify-center bg-ink pb-24 pt-10 md:pt-14">
      <div className="w-full max-w-md border border-line p-8 md:p-10">
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
            className={`px-4 pb-3 transition-colors ${
              !isRegister ? "border-b border-gold text-gold" : "text-ivory-dim hover:text-gold"
            }`}
          >
            Sign In
          </Link>
          <Link
            href={modeHref("register")}
            aria-current={isRegister ? "page" : undefined}
            className={`px-4 pb-3 transition-colors ${
              isRegister ? "border-b border-gold text-gold" : "text-ivory-dim hover:text-gold"
            }`}
          >
            Create Account
          </Link>
        </div>

        {errorMessage && (
          <p role="alert" className="mt-6 text-sm text-red-400">
            {errorMessage}
          </p>
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
            <input
              type="password"
              name="password"
              required
              minLength={isRegister ? 8 : undefined}
              autoComplete={isRegister ? "new-password" : "current-password"}
              className="border border-line bg-transparent px-4 py-3 text-sm text-ivory focus:border-gold focus:outline-none"
            />
          </label>

          <button
            type="submit"
            className="mt-2 bg-gold-deep px-6 py-4 text-xs uppercase tracking-[0.2em] text-ink transition-colors hover:bg-gold-deep/90"
          >
            {isRegister ? "Create Account" : "Sign In"}
          </button>
        </form>
      </div>
    </div>
  );
}
