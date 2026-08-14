"use client";

import { useState, useTransition } from "react";
import { useToast } from "@/components/dashboard/ToastProvider";
import type { OrderStatus } from "@/lib/types";

// No "Shipped". The real flow is Pending Verification -> Confirmed ->
// Completed: orders are delivered the same evening (see the delivery window
// at checkout), so there is no period where "shipped but not delivered"
// describes anything. The value stays in the OrderStatus union and in the
// table's check constraint so any historical row carrying it is still valid
// and still readable -- it simply cannot be chosen again.
const STATUSES: OrderStatus[] = [
  "Pending Verification",
  "Confirmed",
  "Completed",
  "Cancelled",
];

export default function OrderStatusForm({
  orderId,
  currentStatus,
  changeStatus,
}: {
  orderId: string;
  currentStatus: OrderStatus;
  changeStatus: (orderId: string, status: OrderStatus) => Promise<void>;
}) {
  const [value, setValue] = useState(currentStatus);
  const [isPending, startTransition] = useTransition();
  const { showToast } = useToast();

  const submit = () => {
    if (value === currentStatus) return;
    startTransition(async () => {
      try {
        await changeStatus(orderId, value);
        showToast(`Order status updated to "${value}".`, "success");
      } catch (err) {
        showToast(err instanceof Error ? err.message : "Couldn't update status. Try again.", "error");
      }
    });
  };

  return (
    <div className="mt-3 flex gap-3">
      <select
        value={value}
        onChange={(e) => setValue(e.target.value as OrderStatus)}
        className="border-b border-line bg-transparent px-1 py-2 font-mono text-sm text-ivory focus:border-gold-deep focus:outline-none"
      >
        {STATUSES.map((s) => (
          <option key={s} value={s} className="bg-ink-2">
            {s}
          </option>
        ))}
      </select>
      <button
        type="button"
        onClick={submit}
        disabled={isPending || value === currentStatus}
        className="bg-gold-deep px-4 py-2 font-mono text-xs uppercase tracking-wide text-ink transition-colors hover:bg-gold-deep/90 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isPending ? "Updating…" : "Update"}
      </button>
    </div>
  );
}
