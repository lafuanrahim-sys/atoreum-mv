"use client";

import { useState, useTransition } from "react";
import { useToast } from "@/components/dashboard/ToastProvider";
import { adminAdjustBalanceAction } from "@/app/actions/boliAdmin";
import { ADMIN_ADJUSTMENT_APPROVAL_THRESHOLD, BOLI_TO_MVR } from "@/lib/boli/config";

const QUICK_AMOUNTS = [100, 500, 1_000, 5_000];

/**
 * Add or take back Sangu for one customer, from their own page. Same action
 * and the same guardrails as the picker on the Sangu dashboard (attributed
 * to the acting admin, reason required, per-adjustment ceiling) -- the only
 * difference is that the customer is already known here, so there's nothing
 * to search for.
 */
export default function CustomerSanguAdjust({
  userId,
  customerName,
  balance,
}: {
  userId: string;
  customerName: string;
  balance: number;
}) {
  const [delta, setDelta] = useState("");
  const [reason, setReason] = useState("");
  const [isPending, startTransition] = useTransition();
  const { showToast } = useToast();

  const deltaNum = Number(delta);
  const valid = Number.isInteger(deltaNum) && deltaNum !== 0;
  const overThreshold = valid && Math.abs(deltaNum) > ADMIN_ADJUSTMENT_APPROVAL_THRESHOLD;
  const canSubmit = valid && !overThreshold && reason.trim().length > 0 && !isPending;

  const submit = () => {
    if (!canSubmit) return;
    startTransition(async () => {
      try {
        await adminAdjustBalanceAction(userId, deltaNum, reason.trim());
        showToast(
          `${deltaNum > 0 ? "Added" : "Removed"} ${Math.abs(deltaNum).toLocaleString()} Sangu ${
            deltaNum > 0 ? "to" : "from"
          } ${customerName}.`,
          "success"
        );
        setDelta("");
        setReason("");
      } catch (err) {
        showToast(err instanceof Error ? err.message : "Adjustment failed.", "error");
      }
    });
  };

  return (
    <div className="border border-line p-6">
      <h2 className="font-mono text-[10px] uppercase tracking-[0.2em] text-ivory-dim">Add or Remove Sangu</h2>
      <p className="mt-2 text-sm text-ivory-dim">
        Recorded in {customerName.split(" ")[0]}&apos;s ledger and attributed to you. Adjustments don&apos;t count
        toward tier progression, so this never silently promotes a tier.
      </p>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <input
          type="number"
          value={delta}
          onChange={(e) => setDelta(e.target.value)}
          placeholder="500"
          aria-label="Amount of Sangu, negative to remove"
          className="w-32 border-b border-line bg-transparent px-1 py-2 font-mono text-sm tabular-nums text-ivory placeholder:text-ivory-dim/60 focus:border-gold-deep focus:outline-none"
        />
        {QUICK_AMOUNTS.map((amount) => (
          <button
            key={amount}
            type="button"
            onClick={() => setDelta(String(amount))}
            className="border border-line px-3 py-1.5 font-mono text-[11px] tabular-nums text-ivory-dim transition-colors hover:border-gold-deep hover:text-gold-deep"
          >
            +{amount.toLocaleString()}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setDelta(delta.startsWith("-") ? delta.slice(1) : delta ? `-${delta}` : "")}
          className="border border-line px-3 py-1.5 font-mono text-[11px] text-ivory-dim transition-colors hover:border-red-400 hover:text-red-400"
        >
          Flip to remove
        </button>
      </div>

      {valid && !overThreshold && (
        <p className="mt-3 text-xs text-ivory-dim">
          Worth MVR{" "}
          {(Math.abs(deltaNum) * BOLI_TO_MVR).toLocaleString("en-US", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}
          . Balance becomes{" "}
          <span className="font-mono tabular-nums text-ivory">{Math.max(0, balance + deltaNum).toLocaleString()}</span>.
        </p>
      )}
      {overThreshold && (
        <p className="mt-3 text-xs text-red-400">
          Over the {ADMIN_ADJUSTMENT_APPROVAL_THRESHOLD.toLocaleString()} Sangu single-adjustment limit. Split this into
          smaller adjustments.
        </p>
      )}

      <input
        type="text"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Reason (required): goodwill credit, support ticket #…"
        aria-label="Reason for the adjustment"
        className="mt-4 w-full border-b border-line bg-transparent px-1 py-2 text-sm text-ivory placeholder:text-ivory-dim/60 focus:border-gold-deep focus:outline-none"
      />

      <button
        type="button"
        disabled={!canSubmit}
        onClick={submit}
        className="mt-5 bg-gold-deep px-5 py-2.5 font-mono text-xs uppercase tracking-[0.15em] text-ink transition-colors hover:bg-gold-deep/90 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isPending ? "Applying…" : deltaNum < 0 ? "Remove Sangu" : "Add Sangu"}
      </button>
    </div>
  );
}
