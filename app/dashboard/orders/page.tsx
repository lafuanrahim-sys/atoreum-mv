import Link from "next/link";
import { getAllOrders } from "@/lib/data/orders.server";
import { changeOrderStatus } from "@/app/actions/orders";
import type { OrderStatus } from "@/lib/types";
import OrderStatusBadge from "@/components/dashboard/OrderStatusBadge";
import AdminActionButton from "@/components/dashboard/AdminActionButton";
import Pagination from "@/components/dashboard/Pagination";
import SortHeader from "@/components/dashboard/SortHeader";
import PageHeader from "@/components/dashboard/PageHeader";

const PAGE_SIZE = 20;

const STATUSES: OrderStatus[] = [
  "Pending Verification",
  "Confirmed",
  "Shipped",
  "Completed",
  "Cancelled",
];

function formatPrice(price: number, currency: string) {
  return `${currency} ${price.toLocaleString("en-US")}`;
}

export default async function DashboardOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; sort?: string; page?: string }>;
}) {
  const { status = "", sort = "date-desc", page: pageParam = "1" } = await searchParams;
  const all = await getAllOrders();

  const filtered = status ? all.filter((o) => o.status === status) : all;

  const [sortKey, sortDir] = sort.split("-");
  const dir = sortDir === "asc" ? 1 : -1;
  const sorted = [...filtered].sort((a, b) => {
    if (sortKey === "amount") return (a.subtotal - b.subtotal) * dir;
    return (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()) * dir;
  });

  const pageCount = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const page = Math.min(pageCount, Math.max(1, Number(pageParam) || 1));
  const paged = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const hrefFor = (opts: { status?: string; sort?: string; page?: number }) => {
    const params = new URLSearchParams();
    const nextStatus = opts.status ?? status;
    const nextSort = opts.sort ?? sort;
    const nextPage = opts.page ?? page;
    if (nextStatus) params.set("status", nextStatus);
    if (nextSort !== "date-desc") params.set("sort", nextSort);
    if (nextPage > 1) params.set("page", String(nextPage));
    const qs = params.toString();
    return qs ? `/dashboard/orders?${qs}` : "/dashboard/orders";
  };

  return (
    <div>
      <PageHeader eyebrow="Sales Ledger" title="Orders" count={all.length} />

      <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 border-b border-line pb-5">
        {[{ key: "", label: "All" }, ...STATUSES.map((s) => ({ key: s, label: s }))].map((opt) => (
          <Link
            key={opt.key || "all"}
            href={hrefFor({ status: opt.key, page: 1 })}
            className={`font-mono text-[10px] uppercase tracking-[0.15em] transition-colors ${
              status === opt.key ? "italic text-gold-deep" : "text-ivory-dim hover:text-ivory"
            }`}
          >
            {opt.label}
          </Link>
        ))}
      </div>

      <div className="mt-2 overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b-2 border-ivory text-left">
            <th className="py-3 pr-4 font-mono text-[10px] font-normal uppercase tracking-[0.2em] text-ivory-dim">Order #</th>
            <th className="py-3 pr-4 font-mono text-[10px] font-normal uppercase tracking-[0.2em] text-ivory-dim">Customer</th>
            <SortHeader
              label="Total"
              sortKey="amount"
              activeSort={sort}
              hrefFor={(s) => hrefFor({ sort: s, page: 1 })}
            />
            <th className="py-3 pr-4 font-mono text-[10px] font-normal uppercase tracking-[0.2em] text-ivory-dim">Payment</th>
            <th className="py-3 pr-4 font-mono text-[10px] font-normal uppercase tracking-[0.2em] text-ivory-dim">Status</th>
            <SortHeader
              label="Placed"
              sortKey="date"
              activeSort={sort}
              hrefFor={(s) => hrefFor({ sort: s, page: 1 })}
            />
            <th className="py-3"></th>
          </tr>
        </thead>
        <tbody>
          {paged.map((o) => (
            <tr key={o.id} className="border-b border-line">
              <td className="py-3 pr-4 font-mono text-ivory">{o.orderNumber}</td>
              <td className="py-3 pr-4 text-ivory-dim">{o.customer.name}</td>
              <td className="py-3 pr-4 font-mono tabular-nums text-ivory-dim">{formatPrice(o.subtotal, o.currency)}</td>
              <td className="py-3 pr-4 text-ivory-dim">
                {(o.paymentMethod ?? "transfer") === "cash" ? "Cash" : "Transfer"}
              </td>
              <td className="py-3 pr-4">
                <OrderStatusBadge status={o.status} />
              </td>
              <td className="py-3 pr-4 font-mono text-xs text-ivory-dim">
                {new Date(o.createdAt).toLocaleDateString()}
              </td>
              <td className="py-3 text-right">
                <div className="flex items-center justify-end gap-4">
                  {o.status !== "Completed" && o.status !== "Cancelled" && (
                    <AdminActionButton
                      action={async () => {
                        "use server";
                        await changeOrderStatus(o.id, "Completed");
                      }}
                      label="Complete"
                      pendingLabel="Updating…"
                      variant="success"
                      toastMessage={`${o.orderNumber} marked as completed.`}
                      icon={
                        <svg viewBox="0 0 16 16" aria-hidden="true" className="h-3 w-3">
                          <path d="M3 8.5l3.2 3.2L13 4.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      }
                    />
                  )}
                  <Link href={`/dashboard/orders/${o.id}`} className="font-mono text-xs uppercase tracking-[0.12em] text-gold-deep hover:underline">
                    View
                  </Link>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>

      {sorted.length === 0 && (
        <p className="mt-6 text-sm text-ivory-dim">No orders match.</p>
      )}

      <Pagination page={page} pageCount={pageCount} hrefFor={(p) => hrefFor({ page: p })} />
    </div>
  );
}
