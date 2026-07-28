import Link from "next/link";
import { getAllOrders } from "@/lib/data/orders.server";
import PageHeader from "@/components/dashboard/PageHeader";

function formatPrice(price: number, currency: string) {
  return `${currency} ${price.toLocaleString("en-US")}`;
}

/**
 * Pre-orders = bank-transfer orders still awaiting payment verification.
 * They're reserved but not yet confirmed sales, so they get their own queue
 * separate from the full order list.
 */
export default function DashboardPreOrdersPage() {
  const preorders = getAllOrders().filter((o) => o.status === "Pending Verification");

  return (
    <div>
      <PageHeader
        eyebrow="Verification Queue"
        title="Pre-Orders"
        count={preorders.length}
        description="Orders awaiting bank-transfer verification. Confirm or cancel them from the order page."
      />

      <div className="mt-6 overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b-2 border-ivory text-left">
              <th className="py-3 pr-4 font-mono text-[10px] font-normal uppercase tracking-[0.2em] text-ivory-dim">Order #</th>
              <th className="py-3 pr-4 font-mono text-[10px] font-normal uppercase tracking-[0.2em] text-ivory-dim">Customer</th>
              <th className="py-3 pr-4 font-mono text-[10px] font-normal uppercase tracking-[0.2em] text-ivory-dim">Items</th>
              <th className="py-3 pr-4 font-mono text-[10px] font-normal uppercase tracking-[0.2em] text-ivory-dim">Total</th>
              <th className="py-3 pr-4 font-mono text-[10px] font-normal uppercase tracking-[0.2em] text-ivory-dim">Placed</th>
              <th className="py-3 pr-4 font-mono text-[10px] font-normal uppercase tracking-[0.2em] text-ivory-dim">Proof</th>
              <th className="py-3"></th>
            </tr>
          </thead>
          <tbody>
            {preorders.map((o) => (
              <tr key={o.id} className="border-b border-line">
                <td className="py-3 pr-4 font-mono text-ivory">{o.orderNumber}</td>
                <td className="py-3 pr-4 text-ivory-dim">{o.customer.name}</td>
                <td className="py-3 pr-4 font-mono tabular-nums text-ivory-dim">
                  {o.items.reduce((n, i) => n + i.quantity, 0)}
                </td>
                <td className="py-3 pr-4 font-mono tabular-nums text-ivory-dim">
                  {formatPrice(o.subtotal, o.currency)}
                </td>
                <td className="py-3 pr-4 font-mono text-xs text-ivory-dim">
                  {new Date(o.createdAt).toLocaleDateString()}
                </td>
                <td className="py-3 pr-4">
                  {o.paymentProofPath ? (
                    <span className="font-mono text-[10px] uppercase tracking-wide text-sand">Uploaded</span>
                  ) : (
                    <span className="font-mono text-[10px] uppercase tracking-wide text-gold-deep">Awaiting</span>
                  )}
                </td>
                <td className="py-3 text-right">
                  <Link href={`/dashboard/orders/${o.id}`} className="font-mono text-xs uppercase tracking-[0.12em] text-gold-deep hover:underline">
                    Review
                  </Link>
                </td>
              </tr>
            ))}
            {preorders.length === 0 && (
              <tr>
                <td colSpan={7} className="py-6 text-sm text-ivory-dim">
                  No pre-orders waiting — all caught up.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
