"use client";

import { useState, useTransition } from "react";
import { sendOrderReceiptAction } from "@/app/actions/orders";

/**
 * Sends the customer their receipt on demand.
 *
 * Its own component rather than an AdminActionButton because that one assumes
 * an action returning void and reports success optimistically — fine for a
 * status change the page then re-renders to prove, wrong for handing work to
 * an SMTP server that may refuse it. Sending mail is the case where "it
 * probably worked" is not good enough: the admin needs to know whether the
 * customer actually has their receipt, and a failure has to say why.
 */
export default function SendReceiptButton({ orderId, email }: { orderId: string; email: string }) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{ ok: true } | { error: string } | null>(null);

  return (
    <div className="flex flex-col items-start gap-1.5">
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            setResult(null);
            setResult(await sendOrderReceiptAction(orderId));
          })
        }
        className="border border-line px-4 py-2 font-mono text-[11px] uppercase tracking-[0.15em] text-ivory-dim transition-colors hover:border-gold-deep hover:text-gold-deep disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? "Sending…" : "Email receipt"}
      </button>
      {result && "ok" in result && (
        <span className="font-mono text-[10px] text-emerald-600">Sent to {email}</span>
      )}
      {result && "error" in result && (
        // The server's own message, not a generic failure: "mailbox full" and
        // "authentication failed" need different responses from the admin.
        <span role="alert" className="max-w-xs font-mono text-[10px] leading-snug text-red-400">
          {result.error}
        </span>
      )}
    </div>
  );
}
