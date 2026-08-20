"use client";

import { useState, useTransition } from "react";
import { resendOrderEmailAction } from "@/app/actions/orderEmail";

/**
 * The order number, and the two ways of not losing it.
 *
 * This matters most for a guest, whose order is attached to no account. The
 * number is the only handle they have on it: without it there is no way to ask
 * what happened to their order, and no way for the shop to be sure the person
 * asking is the one who placed it.
 *
 * So the number is shown large enough to photograph, and the email that
 * carries it can be re-sent to an address they can actually reach. People
 * mistype their own email constantly, and a receipt sitting in a mailbox that
 * does not exist is indistinguishable from one never sent.
 */
export default function KeepYourOrderNumber({
  orderId,
  accessToken,
  orderNumber,
  guestRef,
  sentTo,
}: {
  orderId: string;
  /** Proves this browser legitimately reached this order's confirmation page.
   *  Without it the resend would accept any order id anyone could guess. */
  accessToken: string;
  orderNumber: string;
  guestRef?: string | null;
  sentTo: string;
}) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  return (
    <div className="mt-8 border border-gold/30 bg-gold/5 p-6">
      <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-gold">Keep this</p>

      <p className="mt-3 select-all font-mono text-2xl tracking-[0.08em] text-ivory tabular-nums">
        {orderNumber}
      </p>
      {guestRef && (
        <p className="mt-1 font-mono text-[11px] text-ivory-dim">
          Guest reference {guestRef}
        </p>
      )}

      <p className="mt-4 text-sm leading-relaxed text-ivory-dim">
        <span className="text-ivory">Take a screenshot of this number.</span> You will need it, along
        with the phone number or email you used, to ask us about this order later.
      </p>

      <p className="mt-3 text-sm leading-relaxed text-ivory-dim">
        We have also emailed the details to <span className="text-ivory">{sentTo}</span>.
      </p>

      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="mt-5 min-h-11 border border-line px-5 font-mono text-[11px] uppercase tracking-[0.15em] text-ivory-dim transition-colors hover:border-gold-deep hover:text-gold-deep"
        >
          Send it to a different email
        </button>
      )}

      {open && (
        <div className="mt-5">
          <label htmlFor="resend-email" className="font-mono text-[10px] uppercase tracking-[0.15em] text-ivory-dim">
            Email address
          </label>
          <div className="mt-2 flex flex-col gap-2 sm:flex-row">
            <input
              id="resend-email"
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setResult(null);
              }}
              placeholder="you@example.com"
              autoComplete="email"
              className="min-h-11 flex-1 rounded-md border border-line bg-transparent px-3 py-2 text-sm text-ivory placeholder:text-ivory-dim/60 focus:border-gold focus:outline-none"
            />
            <button
              type="button"
              disabled={pending || !email.includes("@")}
              onClick={() =>
                startTransition(async () => {
                  setResult(await resendOrderEmailAction(orderId, accessToken, email));
                })
              }
              className="min-h-11 bg-gold-deep px-6 font-mono text-[11px] uppercase tracking-[0.15em] text-ink transition-colors hover:bg-gold-deep/90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {pending ? "Sending…" : "Send"}
            </button>
          </div>
          {result && (
            <p
              role="status"
              className={`mt-3 font-mono text-[11px] ${result.ok ? "text-emerald-500" : "text-red-400"}`}
            >
              {result.message}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
