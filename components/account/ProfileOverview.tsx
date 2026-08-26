import Link from "next/link";
import type { CSSProperties } from "react";
import {
  BOLI_TO_MVR,
  TIER_MULTIPLIER,
  TIER_THRESHOLD_LIFETIME_EARNED,
  type BoliTier,
} from "@/lib/boli/config";

/**
 * The membership panel at the top of the Profile tab: who you are, what tier
 * you've reached, what that's worth, and where your account stands right
 * now. Deliberately reads as a card rather than a form -- it's the one place
 * a customer sees their standing summarised, so it leads with the tier name
 * at display size and lets everything else sit quietly underneath.
 */

const TIER_LABEL: Record<BoliTier, string> = {
  faru: "Faru",
  vilu: "Vilu",
  kandu: "Kandu",
  thari: "Thari",
};

/** What each tier is named after, so the ladder reads as a place rather than a number. */
const TIER_MEANING: Record<BoliTier, string> = {
  faru: "the reef",
  vilu: "the lagoon",
  kandu: "the channel",
  thari: "the star",
};

const TIER_ORDER: BoliTier[] = ["faru", "vilu", "kandu", "thari"];

export type ProfileOverviewData = {
  name: string;
  email: string;
  memberSince: string;
  sangu: { balance: number; lifetimeEarned: number; tier: BoliTier } | null;
  orderCount: number;
  lifetimeSpend: number;
  currency: string;
  favoritesCount: number;
  lastOrder: {
    id: string;
    orderNumber: string;
    placedAt: string;
    status: string;
    total: number;
    currency: string;
    itemCount: number;
  } | null;
};

function formatPrice(value: number, currency: string) {
  return `${currency} ${value.toLocaleString("en-US")}`;
}

export default function ProfileOverview({ data }: { data: ProfileOverviewData }) {
  const tier = data.sangu?.tier ?? "faru";
  const tierIndex = TIER_ORDER.indexOf(tier);
  const nextTier = TIER_ORDER[tierIndex + 1] ?? null;
  const lifetimeEarned = data.sangu?.lifetimeEarned ?? 0;
  const currentThreshold = TIER_THRESHOLD_LIFETIME_EARNED[tier];
  const nextThreshold = nextTier ? TIER_THRESHOLD_LIFETIME_EARNED[nextTier] : null;
  const toNext = nextThreshold ? Math.max(0, nextThreshold - lifetimeEarned) : 0;
  const progressPct = nextThreshold
    ? Math.min(100, Math.max(0, ((lifetimeEarned - currentThreshold) / (nextThreshold - currentThreshold)) * 100))
    : 100;

  return (
    <div className="flex flex-col gap-8">
      {/* Membership card: a raised glass panel — gradient, hairline, inset top
          highlight. The sign-in card used to match it and no longer does; it
          was deliberately re-cut as a recess with its controls standing out of
          it. Left as-is here on purpose: this card holds no inputs, so it has
          nothing to stand proud of it, and a recess with nothing raised inside
          reads as a dent rather than as depth.

          The tier's own colour now runs through it (see the tier block in
          globals.css). All four tiers used to render in the same greys, so the
          card said "Faru" without ever showing what Faru was, and the tier
          above looked identical to the one you were standing on. */}
      <div
        className="relative overflow-hidden rounded-2xl border border-ivory/15 bg-ink-2/50 p-8 shadow-[0_1px_0_0_rgba(255,255,255,0.08)_inset,0_24px_56px_-32px_rgba(0,0,0,0.65)] md:p-10"
        style={
          {
            "--tier-accent": `var(--tier-${tier}-accent)`,
            "--tier-glow": `var(--tier-${tier}-glow)`,
          } as CSSProperties
        }
      >
        {/* The water this tier is named for. Decorative, and behind everything. */}
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-[linear-gradient(150deg,rgba(255,255,255,0.08),rgba(255,255,255,0)_55%)]"
        />
        <div
          aria-hidden="true"
          className="absolute -right-24 -top-28 h-80 w-80 rounded-full bg-[radial-gradient(circle,var(--tier-glow),transparent_70%)] blur-2xl"
        />

        <div className="relative">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-ivory-dim">Member since</p>
              <p className="mt-2 text-sm text-ivory-dim">{data.memberSince}</p>
            </div>
            <div className="text-right">
              <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-ivory-dim">Tier</p>
              <p className="mt-2 font-mono text-sm tabular-nums text-ivory-dim">
                {tierIndex + 1} of {TIER_ORDER.length}
              </p>
            </div>
          </div>

          <div className="mt-8 flex flex-wrap items-end justify-between gap-x-10 gap-y-8">
            <div className="min-w-0">
              <h2 className="font-display text-5xl leading-none text-[var(--tier-accent)] md:text-6xl">
                {TIER_LABEL[tier]}
              </h2>

              {/* The earning rate was a clause in the middle of a sentence. It
                  is the whole point of holding a tier, so it gets to be an
                  object on the page instead of something to read past. */}
              <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2">
                <span
                  className="rounded-full px-3 py-1 font-mono text-[11px] tabular-nums tracking-[0.08em]"
                  style={{
                    color: "var(--tier-accent)",
                    backgroundColor: "color-mix(in srgb, var(--tier-accent) 14%, transparent)",
                    boxShadow: "inset 0 0 0 1px color-mix(in srgb, var(--tier-accent) 38%, transparent)",
                  }}
                >
                  {TIER_MULTIPLIER[tier]}× Sangu
                </span>
                <span className="text-sm text-ivory-dim">on everything you buy</span>
              </div>

              <p className="mt-3 text-sm text-ivory-dim">Named for {TIER_MEANING[tier]}.</p>
            </div>

            {/* Right-aligned only once it is actually beside the tier name.
                Stacked under it on a phone, text-right left the label at the
                edge and the number floating in from it. */}
            <div className="text-left sm:text-right">
              <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-ivory-dim">Sangu balance</p>
              <p className="mt-2 font-display text-4xl leading-none text-[var(--tier-accent)] tabular-nums md:text-5xl">
                {(data.sangu?.balance ?? 0).toLocaleString()}
              </p>
              <p className="mt-2 text-xs text-ivory-dim">
                MVR {((data.sangu?.balance ?? 0) * BOLI_TO_MVR).toFixed(2)} in value
              </p>
            </div>
          </div>

          {/* Tier ladder: every rung, in the colour of the water it is named
              for, so the tiers ahead read as places rather than as greyed-out
              words. Each carries its multiplier, which is the actual reason to
              climb and previously appeared nowhere on this card. */}
          <div className="mt-10">
            <div className="flex items-end gap-2">
              {TIER_ORDER.map((t, i) => {
                const reached = i <= tierIndex;
                const isCurrent = i === tierIndex;
                return (
                  <div key={t} className="min-w-0 flex-1">
                    {/* Locked rungs keep their own hue, muted: enough to read
                        as a destination with a colour of its own, too faint to
                        be mistaken for somewhere you have already been. */}
                    <div
                      className="h-[3px] w-full rounded-full"
                      style={{
                        background: reached
                          ? `var(--tier-${t}-accent)`
                          : `color-mix(in srgb, var(--tier-${t}-accent) 40%, transparent)`,
                      }}
                    />
                    <p
                      className={`mt-2.5 truncate font-mono text-[10px] uppercase tracking-[0.15em] ${
                        isCurrent ? "" : "text-ivory-dim"
                      }`}
                      style={isCurrent ? { color: `var(--tier-${t}-accent)` } : undefined}
                    >
                      {TIER_LABEL[t]}
                    </p>
                    {/* Earned rungs carry their tier's colour, locked ones sit
                        in the muted text tone. The difference is hue rather
                        than opacity on purpose: fading this to 70% put it at
                        2.9:1 on the light card, which is unreadable, and the
                        rung above it already says which is which. */}
                    <p
                      className={`mt-1 font-mono text-[11px] tabular-nums ${reached ? "" : "text-ivory-dim"}`}
                      style={reached ? { color: `var(--tier-${t}-accent)` } : undefined}
                    >
                      {TIER_MULTIPLIER[t]}×
                    </p>
                  </div>
                );
              })}
            </div>

            {nextTier ? (
              <>
                {/* The track is tinted toward the tier being climbed to, so a
                    nearly empty bar still shows where it is heading instead of
                    reading as an empty trough. */}
                <div
                  className="mt-7 h-2 w-full overflow-hidden rounded-full"
                  style={{
                    background: `linear-gradient(90deg, color-mix(in srgb, var(--tier-${nextTier}-accent) 8%, transparent), color-mix(in srgb, var(--tier-${nextTier}-accent) 22%, transparent))`,
                  }}
                >
                  <div
                    className="relative h-full overflow-hidden rounded-full"
                    style={{
                      // A floor, so someone at the very start of a tier sees a
                      // bead of progress rather than a bar that looks broken.
                      width: `${Math.max(progressPct, 2)}%`,
                      background: "var(--tier-accent)",
                    }}
                  >
                    <span
                      aria-hidden="true"
                      className="tier-progress-sheen absolute inset-y-0 -left-8 w-8 bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.55),transparent)]"
                    />
                  </div>
                </div>
                <p className="mt-3.5 text-xs text-ivory-dim">
                  {toNext.toLocaleString()} more lifetime Sangu to reach{" "}
                  <span style={{ color: `var(--tier-${nextTier}-accent)` }}>{TIER_LABEL[nextTier]}</span> and
                  earn {TIER_MULTIPLIER[nextTier]}× on every order.
                </p>
              </>
            ) : (
              <p className="mt-7 text-xs text-ivory-dim">
                You are at the top of the ladder, earning {TIER_MULTIPLIER[tier]}× on everything.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* At-a-glance figures, hairline-divided rather than boxed, matching the
          rest of the storefront's editorial language. */}
      <div className="grid grid-cols-2 gap-x-8 gap-y-8 border-y border-line py-8 sm:grid-cols-4">
        <Figure label="Orders" value={String(data.orderCount)} sub={data.orderCount === 1 ? "placed" : "placed to date"} />
        <Figure label="Lifetime spend" value={formatPrice(data.lifetimeSpend, data.currency)} sub="Excludes cancelled" />
        <Figure
          label="Sangu earned"
          value={lifetimeEarned.toLocaleString()}
          sub="All time, every source"
        />
        <Figure label="Favorites" value={String(data.favoritesCount)} sub="Saved for later" />
      </div>

      {/* Last order */}
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-ivory">Last order</p>
        {data.lastOrder ? (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-4 border border-line p-6">
            <div>
              <p className="font-mono text-sm text-ivory">{data.lastOrder.orderNumber}</p>
              <p className="mt-1 text-xs text-ivory-dim">
                {new Date(data.lastOrder.placedAt).toLocaleDateString()} ·{" "}
                {data.lastOrder.itemCount} item{data.lastOrder.itemCount === 1 ? "" : "s"} ·{" "}
                <span className="uppercase tracking-[0.15em]">{data.lastOrder.status}</span>
              </p>
            </div>
            <div className="flex items-center gap-6">
              <span className="font-display text-xl text-ivory tabular-nums">
                {formatPrice(data.lastOrder.total, data.lastOrder.currency)}
              </span>
              <Link
                href="/account?tab=orders"
                className="text-xs uppercase tracking-[0.2em] text-gold transition-colors hover:underline"
              >
                All orders →
              </Link>
            </div>
          </div>
        ) : (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-4 border border-line p-6">
            <p className="text-sm text-ivory-dim">No orders yet. Your first one will appear here.</p>
            <Link
              href="/products"
              className="border border-gold px-5 py-2.5 text-xs uppercase tracking-[0.2em] text-gold transition-colors hover:bg-gold-deep hover:text-ink"
            >
              Browse the collection
            </Link>
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-x-8 gap-y-2 text-xs uppercase tracking-[0.2em]">
        <Link href="/account?tab=boli" className="text-gold transition-colors hover:underline">
          Sangu &amp; history →
        </Link>
        <Link href="/account?tab=favorites" className="text-ivory-dim transition-colors hover:text-gold">
          Favorites →
        </Link>
        <Link href="/terms/boli" className="text-ivory-dim transition-colors hover:text-gold">
          Sangu terms →
        </Link>
      </div>
    </div>
  );
}

function Figure({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div>
      <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ivory-dim">{label}</p>
      <p className="mt-2 font-display text-2xl text-ivory tabular-nums">{value}</p>
      <p className="mt-1 text-xs text-ivory-dim/80">{sub}</p>
    </div>
  );
}
