import Link from "next/link";
import {
  BOLI_TO_MVR,
  TIER_MULTIPLIER,
  TIER_THRESHOLD_LIFETIME_EARNED,
  EXPIRY_WARNING_WINDOW_DAYS,
  type BoliTier,
} from "@/lib/boli/config";
import type { BoliLedgerEntry } from "@/lib/boli/ledger.server";

function formatSangu(n: number) {
  return n.toLocaleString("en-US");
}
function formatMvr(boli: number) {
  return `MVR ${(boli * BOLI_TO_MVR).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const TIER_LABEL: Record<BoliTier, string> = {
  faru: "Faru",
  vilu: "Vilu",
  kandu: "Kandu",
  thari: "Thari",
};

const TIER_ORDER: BoliTier[] = ["faru", "vilu", "kandu", "thari"];

/** Round number used only to make the tier multiplier tangible in copy ("an order earning 1,000 base Sangu pays you …"). Not a rate — the real earn rate is PURCHASE_EARN_BOLI/PURCHASE_EARN_PER_MVR. */
const EXAMPLE_BASE_BOLI = 1_000;

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

export type PendingBoliOrder = { orderId: string; orderNumber: string; estimatedSangu: number; placedAt: string };

export default function BoliSection({
  displayBalance,
  lifetimeEarned,
  tier,
  underReview,
  pendingOrders,
  expiringSoon,
  ledger,
  page,
  hasMore,
}: {
  displayBalance: number;
  lifetimeEarned: number;
  tier: BoliTier;
  underReview: boolean;
  pendingOrders: PendingBoliOrder[];
  expiringSoon: number;
  ledger: BoliLedgerEntry[];
  page: number;
  hasMore: boolean;
}) {
  const tierIndex = TIER_ORDER.indexOf(tier);
  const nextTier = TIER_ORDER[tierIndex + 1] ?? null;
  const nextThreshold = nextTier ? TIER_THRESHOLD_LIFETIME_EARNED[nextTier] : null;
  const currentThreshold = TIER_THRESHOLD_LIFETIME_EARNED[tier];
  const progressPct = nextThreshold
    ? Math.min(100, Math.round(((lifetimeEarned - currentThreshold) / (nextThreshold - currentThreshold)) * 100))
    : 100;

  return (
    <div>
      {underReview && (
        <div className="mb-8 border border-red-400/50 bg-red-400/5 p-5">
          <p className="text-sm text-ivory">
            Your Sangu balance is under review following an account adjustment. Redemption is paused until this
            clears. Contact us if you have questions.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-8 sm:grid-cols-2">
        <div className="border border-line p-6">
          <p className="text-xs uppercase tracking-[0.2em] text-ivory-dim">Balance</p>
          <p className="mt-3 font-display text-4xl text-gold tabular-nums">{formatSangu(displayBalance)}</p>
          <p className="mt-1 text-sm text-ivory-dim">{formatMvr(displayBalance)} in value</p>
        </div>

        <div className="border border-line p-6">
          <div className="flex items-baseline justify-between">
            <p className="text-xs uppercase tracking-[0.2em] text-ivory-dim">Tier</p>
            <p className="text-sm text-gold">{TIER_LABEL[tier]}</p>
          </div>
          <p className="mt-3 text-sm text-ivory-dim">
            Earning at <span className="text-ivory">{TIER_MULTIPLIER[tier]}×</span> on every purchase
          </p>
          {nextTier ? (
            <>
              <div className="mt-4 h-1 w-full bg-line">
                <div className="h-full bg-gold" style={{ width: `${progressPct}%` }} />
              </div>
              <p className="mt-2 text-xs text-ivory-dim">
                {formatSangu(Math.max(0, (nextThreshold ?? 0) - lifetimeEarned))} more lifetime Sangu to {TIER_LABEL[nextTier]}
              </p>
            </>
          ) : (
            <p className="mt-4 text-xs text-ivory-dim">You&apos;ve reached the top tier.</p>
          )}
        </div>
      </div>

      {/* Full tier ladder. The Tier card above only ever shows the current
          tier and the next one; this lays out all four with the exact
          multiplier each one earns at, so the reward for climbing is
          legible before you get there. Thresholds and multipliers both come
          straight from lib/boli/config.ts — the same constants
          creditPurchaseEarn() actually multiplies by at credit time, so
          this table can never drift from what gets paid out. */}
      <div className="mt-8 border border-line p-6">
        <p className="text-xs uppercase tracking-[0.2em] text-ivory-dim">Tiers</p>
        <ul className="mt-5 flex flex-col divide-y divide-line">
          {TIER_ORDER.map((t) => {
            const isCurrent = t === tier;
            const reached = lifetimeEarned >= TIER_THRESHOLD_LIFETIME_EARNED[t];
            return (
              <li
                key={t}
                className={`flex items-center justify-between gap-4 py-3 ${isCurrent ? "text-ivory" : "text-ivory-dim"}`}
              >
                <span className="flex min-w-0 items-baseline gap-2">
                  <span className={`text-sm ${isCurrent ? "text-gold" : ""}`}>{TIER_LABEL[t]}</span>
                  {isCurrent && (
                    <span className="shrink-0 text-[10px] uppercase tracking-[0.2em] text-gold/70">You</span>
                  )}
                  {!isCurrent && reached && (
                    <span className="shrink-0 text-[10px] uppercase tracking-[0.2em] text-ivory-dim/60">Passed</span>
                  )}
                </span>
                <span className="flex shrink-0 items-baseline gap-6">
                  <span className="text-xs tabular-nums text-ivory-dim">
                    {TIER_THRESHOLD_LIFETIME_EARNED[t] === 0
                      ? "From the start"
                      : `${formatSangu(TIER_THRESHOLD_LIFETIME_EARNED[t])} lifetime`}
                  </span>
                  <span className={`w-12 text-right text-sm tabular-nums ${isCurrent ? "text-gold" : ""}`}>
                    {TIER_MULTIPLIER[t]}×
                  </span>
                </span>
              </li>
            );
          })}
        </ul>
        <p className="mt-4 text-xs leading-relaxed text-ivory-dim/80">
          Your tier multiplies the Sangu you earn on every completed order. At {TIER_MULTIPLIER[tier]}×, an order
          earning {formatSangu(EXAMPLE_BASE_BOLI)} base Sangu pays you{" "}
          <span className="text-ivory">{formatSangu(Math.floor(EXAMPLE_BASE_BOLI * TIER_MULTIPLIER[tier]))}</span>. Only
          purchases count toward reaching the next tier; Sangu Dive winnings and account adjustments don&apos;t.
        </p>
      </div>

      {pendingOrders.length > 0 && (
        <div className="mt-8 border border-line p-6">
          <p className="text-xs uppercase tracking-[0.2em] text-ivory-dim">Pending</p>
          <ul className="mt-4 flex flex-col gap-3">
            {pendingOrders.map((o) => (
              <li key={o.orderId} className="flex items-center justify-between text-sm">
                <span className="text-ivory-dim">
                  {o.orderNumber} <span className="text-ivory-dim/60">· placed {new Date(o.placedAt).toLocaleDateString()}</span>
                </span>
                <span className="text-ivory tabular-nums">+{formatSangu(o.estimatedSangu)} Sangu</span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-ivory-dim/80">
            Unlocks once each order is marked completed, estimated at your current tier.
          </p>
        </div>
      )}

      {expiringSoon > 0 && (
        <p className="mt-8 flex items-center gap-2 border border-gold/40 bg-gold/5 px-5 py-4 text-sm text-gold">
          <svg viewBox="0 0 16 16" aria-hidden="true" className="h-4 w-4 shrink-0">
            <circle cx="8" cy="8" r="6.5" fill="none" stroke="currentColor" strokeWidth="1.2" />
            <path d="M8 5v3.5M8 10.8v.7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
          </svg>
          {formatSangu(expiringSoon)} Sangu expire within {EXPIRY_WARNING_WINDOW_DAYS} days.
        </p>
      )}

      <div className="mt-10 border-t border-line pt-8">
        <p className="text-xs uppercase tracking-[0.2em] text-ivory">Ways to Earn</p>
        <ul className="mt-4 flex flex-col gap-2 text-sm text-ivory-dim">
          <li>Shop: earn Sangu on every completed order, boosted by your tier</li>
          <li>
            <Link href="/terms/boli" className="text-gold hover:underline">
              Read the full Sangu terms
            </Link>
          </li>
        </ul>
      </div>

      <div className="mt-10 border-t border-line pt-8">
        <p className="text-xs uppercase tracking-[0.2em] text-ivory">History</p>
        {ledger.length === 0 ? (
          <p className="mt-4 text-sm text-ivory-dim">No Sangu activity yet.</p>
        ) : (
          <ul className="mt-4 flex flex-col divide-y divide-line">
            {ledger.map((entry) => {
              const delta = Number(entry.delta);
              return (
                <li key={entry.id} className="flex items-center justify-between py-3 text-sm">
                  <div>
                    <p className="text-ivory">{REASON_LABEL[entry.reason] ?? entry.reason}</p>
                    <p className="text-xs text-ivory-dim">{new Date(entry.created_at).toLocaleDateString()}</p>
                  </div>
                  <span className={`tabular-nums ${delta > 0 ? "text-gold" : "text-ivory-dim"}`}>
                    {delta > 0 ? "+" : ""}
                    {formatSangu(delta)}
                  </span>
                </li>
              );
            })}
          </ul>
        )}

        {(page > 1 || hasMore) && (
          <div className="mt-6 flex items-center justify-center gap-6">
            {page > 1 ? (
              <Link
                href={`/account?tab=boli&boliPage=${page - 1}`}
                className="text-xs uppercase tracking-[0.2em] text-ivory-dim hover:text-gold"
              >
                ← Prev
              </Link>
            ) : (
              <span className="text-xs uppercase tracking-[0.2em] text-ivory-dim opacity-30">← Prev</span>
            )}
            <span className="text-xs text-ivory-dim">Page {page}</span>
            {hasMore ? (
              <Link
                href={`/account?tab=boli&boliPage=${page + 1}`}
                className="text-xs uppercase tracking-[0.2em] text-ivory-dim hover:text-gold"
              >
                Next →
              </Link>
            ) : (
              <span className="text-xs uppercase tracking-[0.2em] text-ivory-dim opacity-30">Next →</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
