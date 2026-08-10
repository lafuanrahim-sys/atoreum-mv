import Link from "next/link";
import { notFound } from "next/navigation";
import PageHeader from "@/components/dashboard/PageHeader";
import OrderStatusBadge from "@/components/dashboard/OrderStatusBadge";
import AdminActionButton from "@/components/dashboard/AdminActionButton";
import CustomerSanguAdjust from "@/components/dashboard/CustomerSanguAdjust";
import { unsuspendGameAccessAction } from "@/app/actions/boliAdmin";
import { getUserById } from "@/lib/data/users.server";
import { getAllOrders } from "@/lib/data/orders.server";
import { getSanguStatsForUsers, EMPTY_SANGU_STATS } from "@/lib/boli/adminStats.server";
import { listLedger } from "@/lib/boli/ledger.server";
import { BOLI_TO_MVR } from "@/lib/boli/config";

const TIER_LABEL: Record<string, string> = {
  faru: "Faru",
  vilu: "Vilu",
  kandu: "Kandu",
  thari: "Thari",
};

const REASON_LABEL: Record<string, string> = {
  purchase_earn: "Purchase reward",
  game_earn: "Sangu Dive",
  streak_chest: "Streak chest",
  redemption: "Redeemed at checkout",
  redemption_reversal: "Redemption returned",
  refund_clawback: "Order cancelled",
  expired: "Expired",
  admin_adjustment: "Account adjustment",
};

function formatPrice(price: number, currency: string) {
  return `${currency} ${price.toLocaleString("en-US")}`;
}

export default async function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getUserById(id);
  if (!user) notFound();

  const [orders, statsMap, ledger] = await Promise.all([
    getAllOrders(),
    getSanguStatsForUsers([id]),
    listLedger(id, { limit: 25 }),
  ]);
  const sangu = statsMap.get(id) ?? EMPTY_SANGU_STATS;

  // userId is the authoritative link (set at checkout from the session);
  // the email match is the fallback for orders placed before it existed, and
  // matches how /account resolves the same question.
  const theirs = orders.filter(
    (o) => o.userId === user.id || o.customer.email.toLowerCase() === user.email.toLowerCase()
  );
  const active = theirs.filter((o) => o.status !== "Cancelled");
  const spend = active.reduce((sum, o) => sum + o.subtotal, 0);
  const currency = theirs[0]?.currency ?? "MVR";

  return (
    <div>
      <PageHeader
        eyebrow="Customer"
        title={user.name}
        description={`${user.email} · joined ${new Date(user.createdAt).toLocaleDateString()}`}
        actions={
          <Link
            href="/dashboard/customers"
            className="border border-line px-5 py-2.5 text-xs uppercase tracking-[0.15em] text-ivory-dim transition-colors hover:border-gold-deep hover:text-gold-deep"
          >
            ← All customers
          </Link>
        }
      />

      <div className="mt-8 grid grid-cols-2 gap-x-8 gap-y-8 border-b border-line pb-8 sm:grid-cols-3 lg:grid-cols-6">
        <Stat label="Sangu balance" value={sangu.balance.toLocaleString()} sub={`MVR ${(sangu.balance * BOLI_TO_MVR).toFixed(2)}`} tone="gain" />
        <Stat label="Accumulated" value={sangu.totalEarned.toLocaleString()} sub="Earned, all sources" />
        <Stat label="Sangu spent" value={sangu.spent.toLocaleString()} sub="Redeemed at checkout" />
        <Stat
          label="Tier"
          value={TIER_LABEL[sangu.tier] ?? sangu.tier}
          sub={`${sangu.tierMultiplier}× on purchases`}
        />
        <Stat label="Orders" value={String(active.length)} sub={theirs.length > active.length ? `${theirs.length - active.length} cancelled` : "None cancelled"} />
        <Stat label="Total spend" value={formatPrice(spend, currency)} sub="Excludes cancelled" />
      </div>

      {sangu.gameAccessSuspended && (
        <div className="mt-8 flex flex-wrap items-center justify-between gap-4 border border-red-400/50 bg-red-400/5 px-5 py-4">
          <p className="text-sm text-ivory">
            Sangu Dive is paused on this account pending fraud review. They can still shop and redeem as normal.
          </p>
          <AdminActionButton
            action={async () => {
              "use server";
              await unsuspendGameAccessAction(user.id);
            }}
            label="Restore Sangu Dive access"
            pendingLabel="Restoring…"
            variant="primary"
            toastMessage={`Sangu Dive access restored for ${user.name}.`}
            confirmTitle="Restore Sangu Dive access?"
            confirmMessage={`${user.name} will be able to play again from their next visit.`}
            confirmLabel="Restore"
          />
        </div>
      )}

      <div className="mt-10">
        <CustomerSanguAdjust userId={user.id} customerName={user.name} balance={sangu.balance} />
      </div>

      <h2 className="mt-14 font-mono text-[10px] uppercase tracking-[0.2em] text-ivory-dim">
        Orders ({theirs.length})
      </h2>
      {theirs.length === 0 ? (
        <p className="mt-3 text-sm text-ivory-dim">No orders yet.</p>
      ) : (
        <ul className="mt-4 flex flex-col border-t border-line">
          {theirs.map((o) => (
            <li key={o.id} className="border-b border-line py-4">
              <div className="flex flex-wrap items-baseline justify-between gap-3">
                <Link
                  href={`/dashboard/orders/${o.id}`}
                  className="font-mono text-sm text-ivory transition-colors hover:text-gold-deep"
                >
                  {o.orderNumber}
                </Link>
                <div className="flex items-center gap-4">
                  <span className="font-mono text-xs text-ivory-dim">
                    {new Date(o.createdAt).toLocaleDateString()}
                  </span>
                  <span className="font-mono text-sm tabular-nums text-ivory">
                    {formatPrice(o.subtotal, o.currency)}
                  </span>
                  <OrderStatusBadge status={o.status} />
                </div>
              </div>
              <ul className="mt-2 flex flex-col gap-1">
                {o.items.map((item) => (
                  <li key={`${o.id}-${item.productId}`} className="flex items-baseline justify-between gap-4 text-xs text-ivory-dim">
                    <span className="truncate">
                      {item.quantity} × {item.name}
                    </span>
                    <span className="shrink-0 font-mono tabular-nums">
                      {formatPrice(item.price * item.quantity, item.currency)}
                    </span>
                  </li>
                ))}
              </ul>
              {o.boliRedeemed ? (
                <p className="mt-2 font-mono text-[11px] text-gold-deep">
                  {o.boliRedeemed.toLocaleString()} Sangu redeemed
                  {o.boliDiscountAmount ? ` · ${formatPrice(o.boliDiscountAmount, o.currency)} off` : ""}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      <h2 className="mt-14 font-mono text-[10px] uppercase tracking-[0.2em] text-ivory-dim">Sangu History</h2>
      {ledger.entries.length === 0 ? (
        <p className="mt-3 text-sm text-ivory-dim">No Sangu activity yet.</p>
      ) : (
        <ul className="mt-4 flex flex-col border-t border-line">
          {ledger.entries.map((entry) => {
            const delta = Number(entry.delta);
            return (
              <li key={entry.id} className="flex items-center justify-between gap-4 border-b border-line py-3">
                <div className="min-w-0">
                  <p className="text-sm text-ivory">{REASON_LABEL[entry.reason] ?? entry.reason}</p>
                  <p className="font-mono text-[11px] text-ivory-dim">
                    {new Date(entry.created_at).toLocaleDateString()}
                    {entry.admin_reason ? ` · ${entry.admin_reason}` : ""}
                  </p>
                </div>
                <span className={`shrink-0 font-mono text-sm tabular-nums ${delta > 0 ? "text-gold-deep" : "text-ivory-dim"}`}>
                  {delta > 0 ? "+" : ""}
                  {delta.toLocaleString()}
                </span>
              </li>
            );
          })}
        </ul>
      )}
      {ledger.hasMore && (
        <p className="mt-4 font-mono text-[11px] text-ivory-dim/70">Showing the 25 most recent entries.</p>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  sub,
  tone = "default",
}: {
  label: string;
  value: string;
  sub: string;
  tone?: "default" | "gain";
}) {
  return (
    <div>
      <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ivory-dim">{label}</p>
      <p className={`mt-2 font-mono text-xl font-medium tabular-nums ${tone === "gain" ? "text-gold-deep" : "text-ivory"}`}>
        {value}
      </p>
      <p className="mt-1 text-xs text-ivory-dim">{sub}</p>
    </div>
  );
}
