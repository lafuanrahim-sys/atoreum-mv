import Link from "next/link";
import Image from "next/image";
import { getCurrentUser } from "@/lib/auth/currentUser.server";
import { getAllOrders } from "@/lib/data/orders.server";
import { getAllProducts } from "@/lib/data/products.server";
import { listUsers } from "@/lib/data/users.server";
import OrderStatusBadge from "@/components/dashboard/OrderStatusBadge";

function formatNumber(n: number) {
  return n.toLocaleString("en-US");
}

/** Tiny inline sparkline from a numeric series (last N days). */
function Sparkline({ values, className }: { values: number[]; className?: string }) {
  const w = 96;
  const h = 28;
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

/** Percent change of the trailing half of a series vs. the leading half — null when there's no baseline to compare against. */
function trailingChange(series: number[]): number | null {
  const half = Math.floor(series.length / 2);
  const prior = series.slice(0, half).reduce((a, b) => a + b, 0);
  const recent = series.slice(half).reduce((a, b) => a + b, 0);
  if (prior === 0) return recent > 0 ? null : 0;
  return ((recent - prior) / prior) * 100;
}

function DeltaPill({ value }: { value: number | null }) {
  if (value === null) {
    return <span className="font-mono text-[11px] uppercase tracking-[0.1em] text-sand">New</span>;
  }
  if (value === 0) return null;
  const up = value > 0;
  return (
    <span
      className={`inline-flex items-center gap-1 font-mono text-[11px] tabular-nums ${up ? "text-gold-deep" : "text-red-400"}`}
    >
      <svg viewBox="0 0 10 10" aria-hidden="true" className={`h-2.5 w-2.5 ${up ? "" : "rotate-180"}`}>
        <path d="M5 1.5l3.5 5h-7z" fill="currentColor" />
      </svg>
      {Math.round(Math.abs(value))}%
      <span className="sr-only">{up ? "increase" : "decrease"} vs. the prior 7 days</span>
    </span>
  );
}

// The store only operates in the Maldives — reading the hour in Malé's own
// timezone (rather than the server's) keeps the greeting honest regardless
// of where this is deployed.
function timeOfDay(): "morning" | "afternoon" | "evening" {
  const h = Number(
    new Intl.DateTimeFormat("en-GB", { hour: "numeric", hour12: false, timeZone: "Indian/Maldives" }).format(new Date())
  );
  if (h < 12) return "morning";
  if (h < 17) return "afternoon";
  return "evening";
}

export default async function DashboardHomePage() {
  const [user, orders, products, allUsers] = await Promise.all([
    getCurrentUser(),
    getAllOrders(),
    getAllProducts(),
    listUsers(),
  ]);
  const customers = allUsers.filter((u) => u.role === "customer");

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
  const revenueDelta = trailingChange(revenueSeries);
  const orderDelta = trailingChange(orderSeries);

  // Best sellers: total quantity per product across non-cancelled orders.
  const soldByProduct = new Map<string, { name: string; image: string | null; qty: number }>();
  for (const order of activeOrders) {
    for (const item of order.items) {
      const entry = soldByProduct.get(item.productId) ?? { name: item.name, image: item.image, qty: 0 };
      entry.qty += item.quantity;
      soldByProduct.set(item.productId, entry);
    }
  }
  const bestSellers = [...soldByProduct.entries()].sort((a, b) => b[1].qty - a[1].qty).slice(0, 4);
  const maxSold = bestSellers[0]?.[1].qty ?? 1;

  const stockCounts = {
    in: products.filter((p) => p.stockStatus === "in-stock").length,
    low: products.filter((p) => p.stockStatus === "low-stock").length,
    out: products.filter((p) => p.stockStatus === "out-of-stock").length,
  };
  const stockTotal = Math.max(products.length, 1);
  const attentionAll = products.filter((p) => p.stockStatus !== "in-stock");
  const attentionShown = attentionAll.slice(0, 8);

  const period = timeOfDay();
  const greeting = period === "morning" ? "Good morning" : period === "afternoon" ? "Good afternoon" : "Good evening";
  const dateline = new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Indian/Maldives",
  }).format(new Date());

  return (
    <div>
      {/* Masthead */}
      <header className="border-b-2 border-ivory pb-6">
        <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-sand">
          {dateline} · Store Briefing
        </p>
        <div className="mt-3 flex flex-wrap items-end justify-between gap-6">
          <h1 className="font-display text-4xl leading-tight text-ivory md:text-5xl">
            {greeting}, <span className="italic text-gold-deep">{user?.name.split(" ")[0]}</span>.
          </h1>
          <div className="flex gap-3">
            <Link
              href="/dashboard/products/new"
              className="bg-gold-deep px-5 py-2.5 text-xs uppercase tracking-[0.15em] text-ink transition-colors hover:bg-gold-deep/90"
            >
              + Add Product
            </Link>
            <Link
              href="/dashboard/preorders"
              className="border border-line px-5 py-2.5 text-xs uppercase tracking-[0.15em] text-ivory-dim transition-colors hover:border-gold-deep hover:text-gold-deep"
            >
              Pre-Orders ({pendingCount})
            </Link>
          </div>
        </div>
        <p className="mt-2 text-sm text-ivory-dim">Here&apos;s the state of Atoreum this {period}.</p>
      </header>

      {/* Headline figures — one dominant number, two supporting, hairline-divided rather than boxed. */}
      <div className="mt-10 flex flex-col gap-8 border-b border-line pb-10 sm:flex-row sm:divide-x sm:divide-line">
        <div className="sm:pr-10">
          <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-ivory-dim">Total Revenue</p>
          <div className="mt-3 flex flex-wrap items-baseline gap-3">
            <span className="flex items-baseline gap-1.5">
              <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-ivory-dim">{currency}</span>
              <span className="font-mono text-5xl font-medium text-ivory tabular-nums md:text-6xl">
                {formatNumber(totalRevenue)}
              </span>
            </span>
            <DeltaPill value={revenueDelta} />
          </div>
          <div className="mt-4 flex items-center gap-4">
            <Sparkline values={revenueSeries} className="h-7 w-24 text-gold-deep" />
            <p className="text-xs text-ivory-dim">{activeOrders.length} paid-or-pending orders</p>
          </div>
        </div>

        <div className="sm:px-10">
          <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-ivory-dim">Orders</p>
          <div className="mt-3 flex flex-wrap items-baseline gap-3">
            <span className="font-mono text-3xl font-medium text-ivory tabular-nums">{formatNumber(orders.length)}</span>
            <DeltaPill value={orderDelta} />
          </div>
          <p className="mt-4 text-xs text-ivory-dim">{pendingCount} awaiting verification</p>
        </div>

        <div className="sm:pl-10">
          <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-ivory-dim">Customers</p>
          <p className="mt-3 font-mono text-3xl font-medium text-ivory tabular-nums">{formatNumber(customers.length)}</p>
          <p className="mt-4 text-xs text-ivory-dim">registered accounts</p>
        </div>
      </div>

      {/* Editorial two-column body: a single hairline rule separates the columns instead of boxed cards. */}
      <div className="mt-12 flex flex-col gap-12 lg:flex-row lg:gap-0">
        <div className="lg:flex-1 lg:pr-10">
          <div className="flex items-baseline justify-between">
            <h2 className="font-display text-xl italic text-ivory">Recent Orders</h2>
            <Link href="/dashboard/orders" className="font-mono text-[11px] uppercase tracking-[0.15em] text-gold-deep hover:underline">
              View all →
            </Link>
          </div>

          <div className="mt-5 overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b-2 border-ivory text-left">
                <th className="pb-2 pr-4 font-mono text-[10px] font-normal uppercase tracking-[0.2em] text-ivory-dim">Order</th>
                <th className="pb-2 pr-4 font-mono text-[10px] font-normal uppercase tracking-[0.2em] text-ivory-dim">Customer</th>
                <th className="hidden pb-2 pr-4 font-mono text-[10px] font-normal uppercase tracking-[0.2em] text-ivory-dim sm:table-cell">
                  Date
                </th>
                <th className="pb-2 pr-4 text-right font-mono text-[10px] font-normal uppercase tracking-[0.2em] text-ivory-dim">
                  Amount
                </th>
                <th className="pb-2 text-right font-mono text-[10px] font-normal uppercase tracking-[0.2em] text-ivory-dim">Status</th>
              </tr>
            </thead>
            <tbody>
              {orders.slice(0, 6).map((o) => (
                <tr key={o.id} className="border-b border-line last:border-b-0">
                  <td className="py-3 pr-4">
                    <Link href={`/dashboard/orders/${o.id}`} className="font-mono text-ivory transition-colors hover:text-gold-deep">
                      {o.orderNumber}
                    </Link>
                  </td>
                  <td className="py-3 pr-4 text-ivory-dim">{o.customer.name}</td>
                  <td className="hidden py-3 pr-4 text-ivory-dim sm:table-cell">
                    {new Date(o.createdAt).toLocaleDateString()}
                  </td>
                  <td className="py-3 pr-4 text-right font-mono tabular-nums text-ivory">
                    {currency} {formatNumber(o.subtotal)}
                  </td>
                  <td className="py-3 text-right">
                    <OrderStatusBadge status={o.status} />
                  </td>
                </tr>
              ))}
              {orders.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-6 text-sm text-ivory-dim">
                    No orders yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          </div>

          {/* Best sellers — ranked leaderboard, bar length maps to relative units sold. */}
          <div className="mt-12">
            <h2 className="font-display text-xl italic text-ivory">Best Selling</h2>
            {bestSellers.length === 0 ? (
              <p className="mt-4 text-sm text-ivory-dim">No sales yet.</p>
            ) : (
              <ul className="mt-5 flex flex-col gap-4">
                {bestSellers.map(([productId, entry], i) => (
                  <li key={productId} className="flex items-center gap-4">
                    <span className="w-6 shrink-0 font-mono text-sm text-sand">{String(i + 1).padStart(2, "0")}</span>
                    <div className="relative h-12 w-12 shrink-0 overflow-hidden bg-photo-well">
                      {entry.image && (
                        <div className="absolute inset-1.5">
                          <Image src={entry.image} alt="" fill className="object-contain" />
                        </div>
                      )}
                    </div>
                    <Link
                      href={`/products/${productId}`}
                      className="min-w-0 flex-1 truncate text-sm text-ivory transition-colors hover:text-gold-deep"
                    >
                      {entry.name}
                    </Link>
                    <div className="hidden h-1 w-28 shrink-0 bg-line sm:block" aria-hidden="true">
                      <div className="h-full bg-gold-deep" style={{ width: `${(entry.qty / maxSold) * 100}%` }} />
                    </div>
                    <span className="w-16 shrink-0 text-right font-mono text-xs tabular-nums text-ivory-dim">
                      {entry.qty} sold
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="hidden w-px shrink-0 bg-line lg:block" aria-hidden="true" />

        {/* Stock signal */}
        <div className="lg:w-80 lg:shrink-0 lg:pl-10">
          <div className="flex items-baseline justify-between">
            <h2 className="font-display text-xl italic text-ivory">Stock Signal</h2>
            <Link href="/dashboard/products" className="font-mono text-[11px] uppercase tracking-[0.15em] text-gold-deep hover:underline">
              Manage →
            </Link>
          </div>

          <div className="mt-5 flex h-1.5 overflow-hidden bg-line" role="img" aria-label={`${stockCounts.in} in stock, ${stockCounts.low} low, ${stockCounts.out} out of stock`}>
            <div className="h-full bg-gold-deep" style={{ width: `${(stockCounts.in / stockTotal) * 100}%` }} />
            <div className="h-full bg-sand" style={{ width: `${(stockCounts.low / stockTotal) * 100}%` }} />
            <div className="h-full bg-red-400" style={{ width: `${(stockCounts.out / stockTotal) * 100}%` }} />
          </div>
          <div className="mt-3 flex flex-wrap justify-between gap-x-4 gap-y-1 font-mono text-[10px] uppercase tracking-[0.15em]">
            <span className="text-gold-deep">{stockCounts.in} In Stock</span>
            <span className="text-sand">{stockCounts.low} Low</span>
            <span className="text-red-400">{stockCounts.out} Out</span>
          </div>

          {attentionAll.length > 0 && (
            <ul className="mt-8 flex flex-col gap-3 border-t border-line pt-6">
              {attentionShown.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-3">
                  <Link
                    href={`/dashboard/products/${p.id}/edit`}
                    className="truncate text-sm text-ivory-dim transition-colors hover:text-gold-deep"
                  >
                    {p.name}
                  </Link>
                  <span
                    className={`shrink-0 font-mono text-[10px] uppercase tracking-[0.15em] ${p.stockStatus === "low-stock" ? "text-sand" : "text-red-400"}`}
                  >
                    {p.stockStatus === "low-stock" ? "Low" : "Out"}
                  </span>
                </li>
              ))}
              {attentionAll.length > attentionShown.length && (
                <li>
                  <Link
                    href="/dashboard/products"
                    className="font-mono text-[11px] uppercase tracking-[0.15em] text-gold-deep hover:underline"
                  >
                    +{attentionAll.length - attentionShown.length} more →
                  </Link>
                </li>
              )}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
