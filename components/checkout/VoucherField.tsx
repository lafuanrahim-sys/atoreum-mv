"use client";

import { useState, useTransition } from "react";
import { checkVoucherAction } from "@/app/actions/vouchers";

/**
 * The gift-voucher box on the payment step.
 *
 * Checking a code before the order is placed is a convenience, not the
 * authority: the balance shown here is a preview, and the actual spend happens
 * inside a locked transaction at checkout, against whatever the voucher holds
 * at that moment. If someone else spends it in between, the order simply gets
 * less than this said — which is why the amount is described as "up to".
 */
export default function VoucherField({ payableMvr }: { payableMvr: number }) {
  const [code, setCode] = useState("");
  const [checking, startChecking] = useTransition();
  const [result, setResult] = useState<{ ok: true; discountMvr: number } | { ok: false; error: string } | null>(null);

  const applied = result?.ok === true;
  // A voucher larger than the order covers the order, not more.
  const willApply = applied ? Math.min(result.discountMvr, payableMvr) : 0;

  return (
    <div className="mt-6 border border-line p-5">
      <p className="text-xs uppercase tracking-[0.15em] text-gold">Gift voucher</p>

      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <input
          name="voucherCode"
          value={code}
          onChange={(e) => { setCode(e.target.value); setResult(null); }}
          placeholder="ATO-XXXX-XXXX-XXXX-XXXX"
          aria-label="Gift voucher code"
          autoComplete="off"
          spellCheck={false}
          className="min-h-11 flex-1 rounded-md border border-line bg-transparent px-3 py-2 font-mono text-sm tracking-[0.1em] text-ivory uppercase placeholder:text-ivory-dim/60 placeholder:tracking-normal focus:border-gold focus:outline-none"
        />
        <button
          type="button"
          disabled={checking || code.trim().length === 0}
          onClick={() => startChecking(async () => setResult(await checkVoucherAction(code)))}
          className="min-h-11 border border-line px-5 font-mono text-[11px] uppercase tracking-[0.15em] text-ivory-dim transition-colors hover:border-gold-deep hover:text-gold-deep disabled:cursor-not-allowed disabled:opacity-50"
        >
          {checking ? "Checking…" : "Apply"}
        </button>
      </div>

      {applied && (
        <p className="mt-3 font-mono text-[11px] text-emerald-600">
          Voucher accepted. Up to MVR {willApply.toLocaleString("en-US")} comes off this order.
        </p>
      )}
      {result && !result.ok && (
        <p role="alert" className="mt-3 font-mono text-[11px] text-red-400">
          {result.error}
        </p>
      )}
      {!result && (
        <p className="mt-3 text-[11px] leading-relaxed text-ivory-dim/80">
          Got a gift code? Enter it here, no account needed. Anything you don&apos;t use stays on the
          voucher for next time.
        </p>
      )}
    </div>
  );
}
