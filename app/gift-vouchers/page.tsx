import type { Metadata } from "next";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/currentUser.server";
import { getSettings } from "@/lib/data/settings.server";
import BuyVoucherForm from "@/components/vouchers/BuyVoucherForm";

export const metadata: Metadata = {
  title: "Gift Vouchers",
  description:
    "Give Korean skincare in the Maldives. Buy an Atoreum MV gift voucher, send the code, and they spend it at checkout — no account needed.",
  alternates: { canonical: "/gift-vouchers" },
};

/**
 * Buying a voucher requires an account, and the page says so rather than
 * hiding the option behind a login wall.
 *
 * The reason is not a preference about signups: an unspent remainder returns
 * to whoever paid, so a voucher bought by nobody would have nowhere to send
 * the balance when it expires. The server action refuses guests independently
 * (see purchaseVoucherAction) — this is the courteous half of that rule.
 */
export default async function GiftVouchersPage() {
  const user = await getCurrentUser();
  const settings = await getSettings();

  return (
    <div className="bg-ink pt-16 pb-28">
      <div className="page-gutter max-w-3xl">
        <p className="text-xs uppercase tracking-[0.25em] text-sand">Gift</p>
        <h1 className="mt-4 font-display text-4xl leading-tight text-ivory md:text-5xl">
          Give someone their next favourite thing.
        </h1>
        <p className="mt-5 max-w-xl text-base leading-relaxed text-ivory-dim">
          An Atoreum MV voucher is spent like money at checkout. Send the code to whoever it&apos;s for —
          they don&apos;t need an account, and they can use it across more than one order until it runs out.
        </p>

        <div className="mt-12 border-t border-line pt-10">
          {user ? (
            <BuyVoucherForm
              bankDetails={{
                bankName: settings.bankName,
                accountName: settings.accountName,
                accountNumber: settings.accountNumber,
              }}
              signedInName={user.name ?? ""}
              signedInEmail={user.email ?? ""}
            />
          ) : (
            <div className="flex flex-col items-start gap-5 border border-line p-8">
              <p className="text-sm leading-relaxed text-ivory-dim">
                Please sign in to buy a gift voucher. We need an account on the purchase so that anything
                the recipient doesn&apos;t spend can find its way back to you as Sangu when the voucher
                expires.
              </p>
              <Link
                href="/login?from=%2Fgift-vouchers"
                className="bg-gold-deep px-6 py-3 font-mono text-xs uppercase tracking-[0.15em] text-ink transition-colors hover:bg-gold-deep/90"
              >
                Sign in
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
