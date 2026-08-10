/**
 * Sangu — every rate, weight, multiplier, cap and threshold in one place.
 * No magic numbers anywhere else in lib/boli/** or the routes/components
 * that call into it. Change a number here, not in the code that reads it.
 *
 * Pure data/config only — no runtime imports, safe from client or server.
 *
 * NAMING: the currency is called **Sangu** everywhere a customer or admin
 * can read it; **boli** remains its internal codename throughout the code
 * — database tables and functions (boli_users, boli_ledger,
 * boli_dive_plays, boli_ledger_write()...), routes (/api/boli/*,
 * /dashboard/boli, /terms/boli), identifiers (BoliSection, BoliTier,
 * BOLI_TO_MVR) and docs/BOLI_SPEC.md all still say boli. That split is
 * deliberate: renaming the display name is a copy change, while renaming
 * the tables would mean migrating a live, hash-chained ledger for no
 * user-visible gain. Treat "boli" in code as meaning Sangu, and never put
 * the word "Boli" into anything rendered.
 */

// ---------------------------------------------------------------------------
// Currency value
// ---------------------------------------------------------------------------

/** 1 Boli = MVR 0.01. */
export const BOLI_TO_MVR = 0.01;

/**
 * Today, 1 Boli is the smallest indivisible unit — there is no subdivision.
 * Nothing reads this constant yet. It exists so that IF Boli is ever
 * represented in a system requiring subdivision (see BOLI_SPEC.md §11),
 * `1 Boli = 10 ** BOLI_DECIMALS` base units becomes a single multiplication
 * instead of a schema migration. Do not build anything against this now.
 */
export const BOLI_DECIMALS = 6;

// ---------------------------------------------------------------------------
// Earning on purchases (BOLI_SPEC.md §4.2)
// ---------------------------------------------------------------------------

/** Boli earned per this many MVR of order subtotal (excludes shipping and any Boli discount already applied). */
export const PURCHASE_EARN_BOLI = 20;
export const PURCHASE_EARN_PER_MVR = 10;
// => 20 / 10 = 2 Boli per MVR spent = 2% effective give-back at BOLI_TO_MVR = 0.01.

export type BoliTier = "faru" | "vilu" | "kandu" | "thari";

/**
 * Tier multiplier applied to purchase-Boli at credit time. Game payouts are
 * NEVER tier-multiplied (BOLI_SPEC.md §4.2).
 *
 * BOLI-ASSUMPTION: the spec names the four tiers and their multipliers but
 * not the lifetime-earned thresholds to reach them. Chosen conservatively
 * from the 2% earn rate (5,000 lifetime Boli ≈ MVR 2,500 lifetime spend to
 * reach Vilu) — tune freely, nothing else in the code depends on the exact
 * numbers.
 */
export const TIER_MULTIPLIER: Record<BoliTier, number> = {
  faru: 1.0,
  vilu: 1.1,
  kandu: 1.25,
  thari: 1.5,
};

export const TIER_THRESHOLD_LIFETIME_EARNED: Record<BoliTier, number> = {
  faru: 0,
  vilu: 5_000,
  kandu: 20_000,
  thari: 50_000,
};

// ---------------------------------------------------------------------------
// Redemption (BOLI_SPEC.md §4.3)
// ---------------------------------------------------------------------------

export const REDEMPTION_BOLI_PER_MVR = 100; // 100 Boli = MVR 1 off

export const MIN_REDEMPTION_BOLI = 1_000; // MVR 10

/** Maximum fraction of order subtotal a single order's Boli discount may cover. */
export const MAX_REDEMPTION_SUBTOTAL_FRACTION = 0.3;

/** Boli discounts never stack with a percentage promo code (this store has no promo-code system yet — kept as a future-proof flag). */
export const ALLOW_STACKING_WITH_PROMO = false;

// ---------------------------------------------------------------------------
// Expiry (BOLI_SPEC.md §4.4)
// ---------------------------------------------------------------------------

export const GAME_BOLI_EXPIRY_DAYS = 60;
export const PURCHASE_BOLI_EXPIRY_DAYS = 365; // "12 months" — 365 days, not calendar-month-accurate; fine at this precision.

/** Warn the user in-app when Boli are due to expire within this many days. */
export const EXPIRY_WARNING_WINDOW_DAYS = 14;

/** One reminder email at this many days before expiry, and never more than one per this many days (see EXPIRY_EMAIL_MIN_GAP_DAYS). */
export const EXPIRY_EMAIL_LEAD_DAYS = 7;
export const EXPIRY_EMAIL_MIN_GAP_DAYS = 14;

// ---------------------------------------------------------------------------
// Boli Dive — payout table (BOLI_SPEC.md §5.2)
// ---------------------------------------------------------------------------

export type DiveOutcomeTier = "common" | "uncommon" | "rare" | "epic" | "treasure";

export const DIVE_PAYOUT_TABLE: Record<DiveOutcomeTier, { weight: number; boli: number }> = {
  common: { weight: 0.62, boli: 25 },
  uncommon: { weight: 0.25, boli: 50 },
  rare: { weight: 0.1, boli: 100 },
  epic: { weight: 0.025, boli: 250 },
  treasure: { weight: 0.005, boli: 1_000 },
};

// ---------------------------------------------------------------------------
// Boli Dive — the board game (BOLI-ASSUMPTION: replaces the original
// scratch-one-of-three-shells mechanic at the owner's explicit request. The
// fraud/concurrency/economic guardrails below carry over unchanged — one
// play per day, atomic ledger write, weekly/monthly/global caps, streak and
// Golden Shell day multipliers — only the roll itself changed shape.)
//
// 9 balls are dealt each day, each independently rolled from
// DIVE_PAYOUT_TABLE above (identical weights/values to before — a ball is
// exactly as likely to be a Treasure as the old single roll was). The
// player blindly picks DIVE_PICK_COUNT of them; the payout is decided by
// whether any of the picked balls' tiers match each other:
//   - all 3 the same tier ("triple")  -> that tier's value × TRIPLE_MATCH_MULTIPLIER
//   - exactly 2 the same tier ("pair") -> that tier's value
//   - all 3 different ("none")         -> the LOWEST of the 3 tiers' value
//     (never zero — same "always feels like a small win" principle as the
//     original design)
// ---------------------------------------------------------------------------

export const DIVE_GRID_SIZE = 9;
export const DIVE_PICK_COUNT = 3;

/** Bonus multiplier when all 3 picked balls share the same tier. */
export const TRIPLE_MATCH_MULTIPLIER = 1.5;

/**
 * Consolation for holding a single Treasure ball with no match.
 *
 * Without it a Treasure only pays on a pair or better, which is 1 play in
 * 12,422 -- measured over 2,000,000 simulated plays, and about once every 34
 * years for someone playing every day. The rarest, most exciting outcome on
 * the board was one almost no customer would ever be paid for, which makes it
 * decoration rather than a prize.
 *
 * At 250 a paying Treasure becomes roughly 1 in 124 plays, at a cost of about
 * 2 laari per player per day. The weekly, monthly and global caps are
 * untouched, so this cannot widen the programme's real exposure -- it only
 * changes how the existing budget is distributed.
 *
 * Set level with the Epic pair (250), never above it. A lone unmatched ball
 * must not out-pay a real match, or matching stops being the point of the
 * game -- and Treasure being the rarest tier is what earns it parity with the
 * second-best match rather than a premium over it.
 */
export const LONE_TREASURE_CONSOLATION_BOLI = 250;


/** If the user's last N plays all resolved to Common (a "none" or a Common "pair"), the next day's board gets a boosted chance at a bigger match — see PITY_BOOST_BALL_COUNT. */
export const PITY_COUNTER_WINDOW = 10;
export const PITY_MINIMUM_TIER: DiveOutcomeTier = "rare";

/**
 * When pity fires, this many of the 9 balls (out of the normal roll) get
 * bumped up to at least PITY_MINIMUM_TIER before the board is dealt — a
 * real, improved CHANCE at a big match, not a guaranteed one, since the
 * player still has to blindly pick 2 of them together. Deliberately keeps
 * player choice meaningful rather than scripting the outcome outright.
 */
export const PITY_BOOST_BALL_COUNT = 3;

// ---------------------------------------------------------------------------
// Streak — the Dhoni Trail (BOLI_SPEC.md §5.3)
// ---------------------------------------------------------------------------

/** Consecutive-day streak length at which the payout multiplier kicks in. */
export const STREAK_MULTIPLIER_START_DAY = 3;
export const STREAK_MULTIPLIER = 1.25;

/** Day the chest fires; the streak counter then resets to 1 (not 0 — that day's play still counts as day 1 of the next week). */
export const STREAK_CHEST_DAY = 7;
/**
 * Paid in full on day STREAK_CHEST_DAY, EXEMPT from the weekly and monthly
 * caps below (boli_dive_play() in lib/boli/schema.sql). It was previously
 * clamped by leftover cap room, which meant a player who completed a streak
 * and hit a big win on the same day received no chest at all — the win ate
 * the headroom the chest needed. Finishing a streak is now always worth this
 * much. The store-wide GLOBAL_DAILY_GAME_BOLI_BUDGET still applies to it.
 */
export const STREAK_CHEST_BOLI = 100;

/** One missed day per calendar month is auto-absorbed by a streak shield. */
export const STREAK_SHIELDS_PER_MONTH = 1;

// ---------------------------------------------------------------------------
// Golden Shell days (BOLI_SPEC.md §5.4)
// ---------------------------------------------------------------------------

export const GOLDEN_SHELL_MULTIPLIER = 1.5;

/**
 * Salt for `goldenWeekday = hash(isoWeekNumber + GOLDEN_SALT) % 7`. Rotate
 * this if the golden-day schedule ever needs to be reshuffled (e.g. after a
 * leak) — changing it changes every future week's golden day but never a
 * past one (past weeks are only ever looked up historically for reporting,
 * never recomputed).
 */
export const GOLDEN_SALT = "atoreum-boli-v1";

// ---------------------------------------------------------------------------
// Hard spend caps — non-negotiable, enforced server-side (BOLI_SPEC.md §5.5)
// ---------------------------------------------------------------------------

export const WEEKLY_GAME_BOLI_CAP = 600;
export const MONTHLY_GAME_BOLI_CAP = 1_800;
export const GLOBAL_DAILY_GAME_BOLI_BUDGET = 50_000;

/** Week/month boundaries for the caps above are computed in this IANA timezone. */
export const BOLI_TIMEZONE = "Asia/Male" as const;

/** Kill switch — flip to false and the game disappears from the UI and the play endpoint returns a friendly "back tomorrow", no deploy required. */
export const GAME_ENABLED = true;

/**
 * TEMPORARY testing flag — lets admin/superadmin accounts replay Boli Dive
 * as many times as they want in a day (a "Play again (testing)" button
 * appears after each reveal) instead of the real one-play-per-day limit,
 * so the whole reward table, streak days, Golden Shell days, and caps can
 * all be exercised in one sitting. The one-play-per-day DB constraint
 * itself (BOLI_SPEC.md §6.3, non-negotiable) is never weakened — replaying
 * works by deleting today's play and its ledger credit and rolling again,
 * not by bypassing the constraint. Regular customers are never affected by
 * this flag either way.
 *
 * SET THIS TO `false` BEFORE LAUNCH — that is the entire "switch back to
 * real 24h gameplay" step; nothing else needs to change.
 */
export const UNLIMITED_DIVE_PLAYS_FOR_ADMINS = false;

// ---------------------------------------------------------------------------
// Fraud controls (BOLI_SPEC.md §6)
// ---------------------------------------------------------------------------

/** Require SMS/OTP phone verification before the game unlocks. Off by default — this site has no SMS provider integration (see BOLI_SPEC.md §6.1 item 3); flip on only after wiring one up. */
export const REQUIRE_PHONE_FOR_GAME = false;

/**
 * Require a verified email before the game unlocks (BOLI_SPEC.md §6.1 item
 * 2). Off by default: this codebase has no email-verification flow at all
 * (accounts are created and usable immediately, see lib/data/users.server.ts)
 * — building one is out of scope for Boli itself, same as the SMS-OTP flag
 * above. BOLI-ASSUMPTION: flip on only after an email-verification flow
 * exists to check against. The disposable-domain block below is
 * independent of this flag and always active — it needs no new
 * infrastructure.
 */
export const REQUIRE_VERIFIED_EMAIL_FOR_GAME = false;

/**
 * Bot-signup control (BOLI_SPEC.md §6.1 item 6: "Cloudflare Turnstile, or
 * the existing equivalent"). Off by default — no CAPTCHA/Turnstile
 * integration exists on this site's registration form and adding one needs
 * external site/secret keys this build doesn't have. BOLI-ASSUMPTION: left
 * as a documented gap, not built.
 */
export const REQUIRE_TURNSTILE_FOR_SIGNUP = false;

/** Flag (not block) accounts sharing a device hash once they hit this count. */
export const DEVICE_HASH_FLAG_THRESHOLD = 5;

/** IP is a weak signal here (heavy CGNAT) — flag only, never block, and only at a high threshold. */
export const IP_FLAG_THRESHOLD = 10;

/** Refund count within the trailing window that triggers a fraud flag + game-access suspension pending review. */
export const REFUND_FLAG_COUNT = 3;
export const REFUND_FLAG_WINDOW_DAYS = 90;

// ---------------------------------------------------------------------------
// Rate limits (BOLI_SPEC.md §6.5)
// ---------------------------------------------------------------------------

export const RATE_LIMITS = {
  play: { perUser: { limit: 10, windowSeconds: 60 }, perIp: { limit: 60, windowSeconds: 60 } },
  redemptionPreview: { perUser: { limit: 30, windowSeconds: 60 } },
} as const;

// ---------------------------------------------------------------------------
// Admin alert thresholds (BOLI_SPEC.md §8)
// ---------------------------------------------------------------------------

export const ALERT_GLOBAL_BUDGET_PCT = 0.8;
export const ALERT_WEEKLY_CAP_PCT = 0.9;
export const ALERT_REDEMPTION_SPIKE_MULTIPLIER = 3;
export const ALERT_DEVICE_COLLISION_COUNT = 5;

/**
 * BOLI_SPEC.md §6.6: "Admin adjustments above a configurable threshold
 * require a second admin's approval." This build has no multi-step
 * approval queue (no existing admin workflow like it to extend — see
 * app/dashboard for the current single-admin-action pattern everywhere
 * else). BOLI-ASSUMPTION: enforced conservatively as a hard per-action cap
 * instead — one admin cannot move more than this many Boli in a single
 * adjustment through the dashboard at all, above this it must be done as
 * multiple smaller, separately-attributed adjustments. Tighter than the
 * spec's literal ask, never looser.
 */
export const ADMIN_ADJUSTMENT_APPROVAL_THRESHOLD = 10_000;

// ---------------------------------------------------------------------------
// Cost model — read this before touching any number above.
// ---------------------------------------------------------------------------
//
// Boli Dive cost model (1 Boli = MVR 0.01) — "pick 3 of 9 balls" mechanic
//   Base EV ................ ~35 Boli/day  = MVR 0.35   (roughly: triples
//     ~10.3 + pairs ~21.2 + no-match consolation ~3.5, approximated
//     treating the 3 picks as independent draws from DIVE_PAYOUT_TABLE —
//     close enough for budgeting; the caps below are the real ceiling)
//   Perfect week (7 plays, 1.25x from day 3, +100 chest, one 1.5x golden day)
//                    ....... ~500 Boli/wk  = MVR 5.00
//   Weekly cap ............. 600 Boli      = MVR 6.00   (dive payouts only)
//   Monthly cap ............ 1,800 Boli    = MVR 18.00  (dive payouts only)
//   Streak chests .......... +100 per 7-day streak, OUTSIDE both caps, so
//     at most ~4 per player per month = +400 Boli = MVR 4.00
//   True per-player ceiling  2,200 Boli/mo = MVR 22.00  (1,800 + 4 chests)
//   100 fully engaged players ............ ~MVR 2,200/month worst case
//
// Actual cost is materially lower than the above because:
//   (a) game Boli cannot be redeemed without a delivered order (see 6.1)
//   (b) game Boli expire at 60 days; breakage on daily-reward currencies
//       typically runs high
// Track real issuance vs. real redemption on the admin dashboard before
// raising any number here.
