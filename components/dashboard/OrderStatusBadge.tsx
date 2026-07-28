import type { OrderStatus } from "@/lib/types";

// A dot + label rather than a boxed chip — the ledger tables carry status
// this way throughout the admin, so an order's status reads the same
// wherever it appears (dashboard, list, detail).
const STYLES: Record<OrderStatus, string> = {
  "Pending Verification": "text-gold-deep",
  Confirmed: "text-sand",
  Shipped: "text-ivory-dim",
  Completed: "text-emerald-600",
  Cancelled: "text-red-400",
};

export default function OrderStatusBadge({ status }: { status: OrderStatus }) {
  return (
    <span className={`inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.12em] ${STYLES[status]}`}>
      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-current" aria-hidden="true" />
      {status}
    </span>
  );
}
