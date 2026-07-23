import Link from "next/link";
import { getAllOrders } from "@/lib/data/orders.server";

function formatPrice(price: number, currency: string) {
  return `${currency} ${price.toLocaleString("en-US")}`;
}

const STATUS_STYLES: Record<string, string> = {
  "Pending Verification": "text-gold",
  Confirmed: "text-sand",
  Shipped: "text-ivory-dim",
  Cancelled: "text-red-400",
};

export default function DashboardOrdersPage() {
  const orders = getAllOrders();

  return (
    <div>
      <h1 className="font-display text-2xl text-ivory">Orders ({orders.length})</h1>

      <table className="mt-6 w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-ivory-dim">
            <th className="py-3 pr-4">Order #</th>
            <th className="py-3 pr-4">Customer</th>
            <th className="py-3 pr-4">Total</th>
            <th className="py-3 pr-4">Status</th>
            <th className="py-3 pr-4">Placed</th>
            <th className="py-3 pr-4"></th>
          </tr>
        </thead>
        <tbody>
          {orders.map((o) => (
            <tr key={o.id} className="border-b border-line/50">
              <td className="py-3 pr-4 text-ivory">{o.orderNumber}</td>
              <td className="py-3 pr-4 text-ivory-dim">{o.customer.name}</td>
              <td className="py-3 pr-4 text-ivory-dim tabular-nums">{formatPrice(o.subtotal, o.currency)}</td>
              <td className={`py-3 pr-4 ${STATUS_STYLES[o.status] ?? "text-ivory-dim"}`}>
                {o.status}
              </td>
              <td className="py-3 pr-4 text-ivory-dim">
                {new Date(o.createdAt).toLocaleDateString()}
              </td>
              <td className="py-3 pr-4 text-right">
                <Link href={`/dashboard/orders/${o.id}`} className="text-gold hover:underline">
                  View
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {orders.length === 0 && (
        <p className="mt-6 text-sm text-ivory-dim">No orders yet.</p>
      )}
    </div>
  );
}
