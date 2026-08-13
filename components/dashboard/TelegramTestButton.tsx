"use client";

import { useState, useTransition } from "react";
import { sendTelegramTestAction } from "@/app/actions/storeAdmin";

type Result = Awaited<ReturnType<typeof sendTelegramTestAction>>;

/**
 * Proves order notifications still work, without waiting for a customer to
 * prove it for you.
 *
 * Modelled on SendReceiptButton rather than AdminActionButton for the same
 * reason: this hands work to a third party that can refuse it, so reporting
 * success optimistically would defeat the point of a test button.
 */
export default function TelegramTestButton() {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<Result | null>(null);

  return (
    <div className="flex flex-col items-start gap-1.5">
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            setResult(null);
            setResult(await sendTelegramTestAction());
          })
        }
        className="border border-line px-4 py-2 font-mono text-[11px] uppercase tracking-[0.15em] text-ivory-dim transition-colors hover:border-gold-deep hover:text-gold-deep disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? "Sending…" : "Send test notification"}
      </button>

      {result && "ok" in result && (
        <span className="font-mono text-[10px] text-emerald-600">
          Delivered to {result.delivered} chat{result.delivered === 1 ? "" : "s"}.
          {/* A partial success is still a problem, and saying only "delivered"
              would hide the recipient who is no longer being told anything. */}
          {result.failed.length > 0 && (
            <span className="text-red-400"> Could not reach {result.failed.join(", ")}.</span>
          )}
        </span>
      )}
      {result && "error" in result && (
        <span role="alert" className="max-w-xs font-mono text-[10px] leading-snug text-red-400">
          {result.error}
        </span>
      )}
    </div>
  );
}
