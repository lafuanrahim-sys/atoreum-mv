import Link from "next/link";
import Image from "next/image";
import { getCurrentUser } from "@/lib/auth/currentUser.server";
import { getAllOrders } from "@/lib/data/orders.server";
import { getAllProducts } from "@/lib/data/products.server";
import { listUsers } from "@/lib/data/users.server";

function formatPrice(price: number, currency: string) {
  return `${currency} ${price.toLocaleString("en-US")}`;
}

const STATUS_STYLES: Record<string, string> = {
  "Pending Verification": "text-gold",
  Confirmed: "text-sand",
  Shipped: "text-ivory-dim",
  Completed: "text-emerald-600 font-semibold",
  Cancelled: "text-red-400",
};

/** Tiny inline sparkline from a numeric series (last N days). */
function Sparkline({ values, className }: { values: number[]; className?: string }) {
  const w = 120;
  const h = 32;
  const max = Math.max(...values, 1);
  const points = values
    .map((v, i) => `${(i / Math.max(values.length - 1, 1)) * w},${h - 2 - (v / max) * (h - 6)}`)
    .join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className={className} aria-hidden="true">
      <polyline points={points} fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

function dailySeries(dates: string[], amounts: number[], days: number): number[] {
  const buckets = new Array(days).fill(0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  dates.forEach((d, i) => {
    const day = new Date(d);
    day.setHours(0, 0, 0, 0);
    const diff = Math.round((today.getTime() - day.getTime()) / 86400000);
    if (diff >= 0 && diff < days) buckets[days - 1 - diff] += amounts[i];
  });
  return buckets;
}

export default async function DashboardHomePage() {
  const user = await getCurrentUser();
  const orders = getAllOrders();
  const products = getAllProducts();
  const customers = listUsers().filter((u) => u.role === "customer");

  const activeOrders = orders.filter((o) => o.status !== "Cancelled");
  const totalRevenue = activeOrders.reduce((sum, o) => sum + o.subtotal, 0);
  const currency = orders[0]?.currency ?? "MVR";
  const pendingCount = orders.filter((o) => o.status === "Pending Verification").length;

  const revenueSeries = dailySeries(
    activeOrders.map((o) => o.createdAt),
    activeOrders.map((o) => o.subtotal),
    14
  );
  const orderSeries = dailySeries(
    activeOrders.map((o) => o.createdAt),
    activeOrders.map(() => 1),
    14
  );

  // Best sellers: total quantity per product across non-cancelled orders.
  const soldByProduct = new Map<string, { name: string; image: string | null; qty: number }>();
  for (const order of activeOrders) {
    for (const item of order.items) {
      const entry = soldByProduct.get(item.productId) ?? { name: item.name, image: item.image, qty: 0 };
      entry.qty += item.quantity;
      soldByProduct.set(item.productId, entry);
    }
  }
  const bestSellers = [...soldByProduct.entries()]
    .sort((a, b) => b[1].qty - a[1].qty)
    .slice(0, 4);

  const stockCounts = {
    in: products.filter((p) => p.stockStatus === "in-stock").length,
    low: products.filter((p) => p.stockStatus === "low-stock").length,
    out: products.filter((p) => p.stockStatus === "out-of-stock").length,
  };
  const attentionProducts = products.filter((p) => p.stockStatus !== "in-stock");

  const stats = [
    {
      label: "Total Revenue",
      value: formatPrice(totalRevenue, currency),
      series: revenueSeries,
      note: `${activeOrders.length} paid-or-pending orders`,
    },
    {
      label: "Total Orders",
      value: String(orders.length),
      series: orderSeries,
      note: `${pendingCount} awaiting verification`,
    },
    {
      label: "Customers",
      value: String(customers.length),
      series: null,
      note: "registered accounts",
    },
  ];

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl text-ivory md:text-3xl">
            Hello, {user?.name.split(" ")[0]} 👋
          </h1>
          <p className="mt-1 text-sm text-ivory-dim">
            Here&apos;s what&apos;s happening with your store today.
          </p>
        </div>
        <div className="flex gap-3">
          <Link
            href="/dashboard/products/new"
            className="bg-gold-deep px-5 py-2.5 text-xs uppercase tracking-[0.15em] text-ink transition-colors hover:bg-gold-deep/90"
          >
            + Add Product
          </Link>
          <Link
            href="/dashboard/preorders"
            className="border border-line px-5 py-2.5 text-xs uppercase tracking-[0.15em] text-ivory-dim transition-colors hover:border-gold hover:text-gold"
          >
            Pre-Orders ({pendingCount})
          </Link>
        </div>
      </div>

      {/* Stat cards */}
      <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {stats.map((stat) => (
          <div key={stat.label} className="rounded-lg border border-line bg-ink p-6">
            <p className="text-xs uppercase tracking-[0.15em] text-ivory-dim">{stat.label}</p>
            <p className="mt-2 font-display text-3xl text-ivory tabular-nums">{stat.value}</p>
            <div className="mt-3 flex items-end justify-between gap-4">
              <p className="text-[11px] text-ivory-dim">{stat.note}</p>
              {stat.series && <Sparkline values={stat.series} className="h-8 w-28 text-gold" />}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-8 grid gap-8 xl:grid-cols-3">
        {/* Recent orders */}
        <div className="xl:col-span-2">
          <div className="flex items-center justify-between">
            <h2 className="text-xs uppercase tracking-[0.2em] text-ivory">Recent Orders</h2>
            <Link href="/dashboard/orders" className="text-xs text-gold hover:underline">
              View all orders
            </Link>
          </div>
          <div className="mt-4 overflow-x-auto rounded-lg border border-line bg-ink">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-ivory-dim">
                  <th className="px-5 py-3">Order</th>
                  <th className="px-5 py-3">Customer</th>
                  <th className="px-5 py-3">Date</th>
                  <th className="px-5 py-3">Amount</th>
                  <th className="px-5 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {orders.slice(0, 6).map((o) => (
                  <tr key={o.id} className="border-b border-line/50 last:border-b-0">
                    <td className="px-5 py-3">
                      <Link href={`/dashboard/orders/${o.id}`} className="text-gold hover:underline">
                        {o.orderNumber}
                      </Link>
                    </td>
                    <td className="px-5 py-3 text-ivory">{o.customer.name}</td>
                    <td className="px-5 py-3 text-ivory-dim">
                      {new Date(o.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-5 py-3 text-ivory-dim tabular-nums">
                      {formatPrice(o.subtotal, o.currency)}
                    </td>
                    <td className={`px-5 py-3 text-xs uppercase tracking-wide ${STATUS_STYLES[o.status] ?? "text-ivory-dim"}`}>
                      {o.status}
                    </td>
                  </tr>
                ))}
                {orders.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-5 py-6 text-sm text-ivory-dim">
                      No orders yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Best sellers */}
          <div className="mt-8">
            <h2 className="text-xs uppercase tracking-[0.2em] text-ivory">Best Selling Products</h2>
            <div className="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
              {bestSellers.map(([productId, entry], i) => (
                <Link
                  key={productId}
                  href={`/products/${productId}`}
                  className="group rounded-lg border border-line bg-ink p-3 transition-colors hover:border-gold"
                >
                  <div className="relative aspect-square overflow-hidden rounded-md bg-photo-well">
                    {entry.image && (
                      <div className="absolute inset-2">
                        <Image src={entry.image} alt={entry.name} fill className="object-contain" />
                      </div>
                    )}
                    <span className="absolute left-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-ink/80 text-[10px] text-ivory">
                      {i + 1}
                    </span>
                  </div>
                  <p className="mt-3 truncate text-xs text-ivory">{entry.name}</p>
                  <p className="mt-1 text-[11px] text-ivory-dim">{entry.qty} sold</p>
                </Link>
              ))}
              {bestSellers.length === 0 && (
                <p className="col-span-full text-sm text-ivory-dim">No sales yet.</p>
              )}
            </div>
          </div>
        </div>

        {/* Stock health */}
        <div>
          <div className="flex items-center justify-between">
            <h2 className="text-xs uppercase tracking-[0.2em] text-ivory">Stock Health</h2>
            <Link href="/dashboard/products" className="text-xs text-gold hover:underline">
              Manage products
            </Link>
          </div>
          <div className="mt-4 rounded-lg border border-line bg-ink p-6">
            <div className="grid grid-cols-3 gap-3 text-center">
              <div>
                <p className="font-display text-2xl text-sand tabular-nums">{stockCounts.in}</p>
                <p className="mt-1 text-[10px] uppercase tracking-[0.12em] text-ivory-dim">In stock</p>
              </div>
              <div>
                <p className="font-display text-2xl text-gold tabular-nums">{stockCounts.low}</p>
                <p className="mt-1 text-[10px] uppercase tracking-[0.12em] text-ivory-dim">Low</p>
              </div>
              <div>
                <p className="font-display text-2xl text-red-400 tabular-nums">{stockCounts.out}</p>
                <p className="mt-1 text-[10px] uppercase tracking-[0.12em] text-ivory-dim">Out</p>
              </div>
            </div>

            {attentionProducts.length > 0 && (
              <ul className="mt-6 flex flex-col gap-3 border-t border-line pt-5">
                {attentionProducts.map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-3 text-sm">
                    <Link
                      href={`/dashboard/products/${p.id}/edit`}
                      className="truncate text-ivory-dim transition-colors hover:text-gold"
                    >
                      {p.name}
                    </Link>
                    <span
                      className={`shrink-0 text-[10px] uppercase tracking-[0.12em] ${
                        p.stockStatus === "low-stock" ? "text-gold" : "text-red-400"
                      }`}
                    >
                      {p.stockStatus === "low-stock" ? "Low" : "Out"}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
