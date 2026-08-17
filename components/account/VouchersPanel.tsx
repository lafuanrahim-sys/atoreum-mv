"use client";

import { useState } from "react";
import type { Voucher } from "@/lib/vouchers/vouchers.server";

/**
 * The buyer's gift vouchers, with the code they need to pass on.
 *
 * The code is shown in full here and nowhere else: this panel only ever
 * renders vouchers the signed-in account paid for. A code is a bearer
 * instrument, so anywhere it appears is somewhere it can be stolen from —
 * which is why it is not in the orders list, not in an email subject, and not
 * in any admin listing.
 */
function money(boli: number) {
  return `MVR ${(boli * 0.01).toLocaleString("en-US", { minimumFractionDigits: 2 })}`;
}

const STATUS_COPY: Record<Voucher["status"], { label: string; tone: string; note: string }> = {
  pending: {
    label: "Awaiting payment",
    tone: "text-ivory-dim",
    note: "We'll show the code here as soon as we've confirmed your payment.",
  },
  active: { label: "Ready to use", tone: "text-emerald-600", note: "" },
  exhausted: { label: "Fully spent", tone: "text-ivory-dim", note: "" },
  expired: {
    label: "Expired",
    tone: "text-ivory-dim",
    note: "Any unspent balance was returned to your Sangu.",
  },
  void: { label: "Cancelled", tone: "text-red-400", note: "" },
};

function VoucherRow({ voucher }: { voucher: Voucher }) {
  const [copied, setCopied] = useState(false);
  const status = STATUS_COPY[voucher.status];
  const spent = voucher.faceValueBoli - voucher.balanceBoli;
  // Pending means paid-for-but-unconfirmed: there is nothing to send yet.
  const locked = voucher.status === "pending";

  return (
    <li className="flex flex-col gap-3 border-b border-line py-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="font-display text-xl text-ivory">{money(voucher.faceValueBoli)} gift voucher</span>
        <span className={`font-mono text-[10px] uppercase tracking-[0.15em] ${status.tone}`}>{status.label}</span>
      </div>

      {/* The code is withheld until the voucher is actually worth something.
          Showing it while payment is unconfirmed invites the buyer to send a
          gift that cannot be spent yet -- the recipient tries it, is told it
          is not active, and both of them think something is broken. */}
      {locked ? (
        <div className="flex flex-wrap items-center gap-3">
          <code
            aria-label="Code hidden until payment is confirmed"
            className="rounded border border-dashed border-line bg-ink-2 px-3 py-2 font-mono text-sm tracking-[0.15em] text-ivory-dim/50 select-none"
          >
            ATO-••••-••••-••••-••••
          </code>
          <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-ivory-dim/70">
            Shown once payment is confirmed
          </span>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          <code className="select-all rounded border border-line bg-ink-2 px-3 py-2 font-mono text-sm tracking-[0.15em] text-gold">
            {voucher.code}
          </code>
          <button
            type="button"
            onClick={() => {
              navigator.clipboard?.writeText(voucher.code).then(
                () => { setCopied(true); setTimeout(() => setCopied(false), 2000); },
                () => setCopied(false)
              );
            }}
            className="border border-line px-3 py-2 font-mono text-[10px] uppercase tracking-[0.15em] text-ivory-dim transition-colors hover:border-gold-deep hover:text-gold-deep"
          >
            {copied ? "Copied" : "Copy code"}
          </button>
        </div>
      )}

      <p className="font-mono text-[11px] text-ivory-dim">
        {voucher.balanceBoli > 0
          ? `${money(voucher.balanceBoli)} left${spent > 0 ? ` · ${money(spent)} used` : ""}`
          : `${money(voucher.faceValueBoli)} used in full`}
        {voucher.expiresAt && voucher.status === "active"
          ? ` · valid until ${new Date(voucher.expiresAt).toLocaleDateString()}`
          : ""}
      </p>
      {status.note && <p className="text-[11px] leading-relaxed text-ivory-dim/80">{status.note}</p>}
    </li>
  );
}

export default function VouchersPanel({ vouchers }: { vouchers: Voucher[] }) {
  if (vouchers.length === 0) {
    return (
      <div className="mt-10 border border-line p-8 text-center">
        <p className="text-sm text-ivory-dim">You haven&apos;t bought a gift voucher yet.</p>
        <a
          href="/gift-vouchers"
          className="mt-5 inline-block bg-gold-deep px-6 py-3 font-mono text-xs uppercase tracking-[0.15em] text-ink transition-colors hover:bg-gold-deep/90"
        >
          Buy a gift voucher
        </a>
      </div>
    );
  }

  return (
    <div className="mt-8">
      <p className="text-sm leading-relaxed text-ivory-dim">
        Send the code to whoever the gift is for. They can spend it at checkout without an account.
        Anything left when it expires comes back to you as Sangu.
      </p>
      <ul className="mt-6 flex flex-col">
        {vouchers.map((v) => (
          <VoucherRow key={v.id} voucher={v} />
        ))}
      </ul>
      <a
        href="/gift-vouchers"
        className="mt-8 inline-block border border-line px-5 py-3 font-mono text-[11px] uppercase tracking-[0.15em] text-ivory-dim transition-colors hover:border-gold-deep hover:text-gold-deep"
      >
        Buy another
      </a>
    </div>
  );
}
