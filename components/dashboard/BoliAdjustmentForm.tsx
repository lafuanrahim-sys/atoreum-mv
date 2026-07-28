"use client";

import { useState, useTransition } from "react";
import { useToast } from "@/components/dashboard/ToastProvider";
import { adminAdjustBalanceAction, unsuspendGameAccessAction } from "@/app/actions/boliAdmin";

/** Manual balance adjustment — always attributed to the acting admin, always requires a reason (BOLI_SPEC.md §6.6). */
export default function BoliAdjustmentForm() {
  const [userId, setUserId] = useState("");
  const [delta, setDelta] = useState("");
  const [reason, setReason] = useState("");
  const [isPending, startTransition] = useTransition();
  const { showToast } = useToast();

  const submit = () => {
    const deltaNum = Number(delta);
    startTransition(async () => {
      try {
        await adminAdjustBalanceAction(userId.trim(), deltaNum, reason.trim());
        showToast(`Adjusted ${userId.trim()} by ${deltaNum > 0 ? "+" : ""}${deltaNum} Boli.`, "success");
        setUserId("");
        setDelta("");
        setReason("");
      } catch (err) {
        showToast(err instanceof Error ? err.message : "Adjustment failed.", "error");
      }
    });
  };

  const unsuspend = () => {
    if (!userId.trim()) {
      showToast("Enter a user id first.", "error");
      return;
    }
    startTransition(async () => {
      try {
        await unsuspendGameAccessAction(userId.trim());
        showToast(`Boli Dive access restored for ${userId.trim()}.`, "success");
      } catch (err) {
        showToast(err instanceof Error ? err.message : "Failed to restore access.", "error");
      }
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <label className="flex flex-col gap-1.5">
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-ivory-dim">User id</span>
          <input
            type="text"
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            placeholder="usr-…"
            className="border-b border-line bg-transparent px-1 py-2 font-mono text-sm text-ivory focus:border-gold-deep focus:outline-none"
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-ivory-dim">Delta (+/- Boli)</span>
          <input
            type="number"
            value={delta}
            onChange={(e) => setDelta(e.target.value)}
            placeholder="-500"
            className="border-b border-line bg-transparent px-1 py-2 font-mono text-sm text-ivory tabular-nums focus:border-gold-deep focus:outline-none"
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-ivory-dim">Reason (required)</span>
          <input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Goodwill credit — support ticket #…"
            className="border-b border-line bg-transparent px-1 py-2 font-mono text-sm text-ivory focus:border-gold-deep focus:outline-none"
          />
        </label>
      </div>
      <div className="flex items-center gap-4">
        <button
          type="button"
          disabled={isPending || !userId.trim() || !delta || !reason.trim()}
          onClick={submit}
          className="bg-gold-deep px-5 py-2.5 font-mono text-xs uppercase tracking-[0.15em] text-ink transition-colors hover:bg-gold-deep/90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Apply adjustment
        </button>
        <button
          type="button"
          disabled={isPending}
          onClick={unsuspend}
          className="font-mono text-xs uppercase tracking-[0.12em] text-ivory-dim transition-colors hover:text-ivory disabled:opacity-50"
        >
          Restore Boli Dive access for this user
        </button>
      </div>
    </div>
  );
}
