# Claude Code Prompt — Atoreum "Boli" Loyalty Currency + Boli Dive

> Save as `docs/BOLI_SPEC.md` in the repo, then tell Claude Code:
> **"Read docs/BOLI_SPEC.md and build Phase 1."**

---

## 1. Context

**Atoreum MV** — a live Maldivian K-beauty store selling LEBELAGE Korean cosmetics. Stack: **Next.js (App Router) + TypeScript + Tailwind + GSAP**. Brand language: reef, lagoon, deep ocean, cowrie shells. Calm and premium, not cartoon-gamified.

I am adding an in-store currency called **Boli** (Dhivehi for *shell* — cowrie shells harvested in the Maldives were real currency across Africa and Asia for centuries), earned by shopping or by playing a daily scratch-to-reveal game called **Boli Dive**.

**The site is already built and in production. This is purely additive.**

---

## 2. Ground rules

- **Do not refactor, restructure, rename or "improve" existing code.** Build alongside it.
- **Do not propose alternative architectures or ask me to approve a plan.** Read the codebase to learn its conventions — auth, ORM, routing, styling, error handling — match them, and build.
- Repo conventions win on *style*; this spec wins on *business rules*.
- If something is blocking and undocumented, make the conservative choice, implement it, leave a `// BOLI-ASSUMPTION:` comment, and keep going.
- **Every rate, weight, multiplier, cap and threshold goes in one config file** (`lib/boli/config.ts`), strongly typed, with the cost commentary from §5 included. No magic numbers anywhere else. I will be tuning these constantly and I must never need a code change to do it.
- Money is at stake in this feature. Where this spec says a control is non-negotiable, it is not a suggestion.

---

## 3. Where it lives

A **new tab in the existing account area**, alongside Orders / Profile / Addresses. Follow whatever tab pattern the account section already uses.

- **Route:** `/account/boli`, tab labelled **"Boli"** with a cowrie shell icon.
- **Section 1 — "My Boli"** (default): balance, tier + progress, pending Boli, expiring-soon warning, ways to earn, paginated transaction history.
- **Section 2 — "Boli Dive"**: today's game, or the result + countdown + streak map if already played.

Plus:
- A **header balance chip** (shell icon + live balance) linking to `/account/boli`.
- A **redemption widget at checkout**.
- An **admin page** (§8) behind existing admin auth.

No separate top-level `/rewards` route.

---

## 4. Currency rules

### 4.1 Value
**1 Boli = MVR 0.01.** 100 Boli = MVR 1.

### 4.2 Earning on purchases
- **20 Boli per MVR 10 spent** on the order subtotal. Effective give-back: **2%**.
- Exclude shipping. Exclude any Boli discount already applied to that order (no earning on the discounted portion — this prevents a slow compounding leak).
- Round **down** to whole Boli.
- Credited when order status becomes **`delivered`** — never at checkout. Display as **"Pending"** with the expected unlock date until then.
- Tier multiplier applies at credit time: Faru 1.0×, Vilu 1.1×, Kandu 1.25×, Thari 1.5×. Tiers are based on `boli_lifetime_earned` from **purchases only**. Game payouts are **never** tier-multiplied and never count toward tier progression.

### 4.3 Redemption
- **100 Boli = MVR 1 off.**
- **Minimum redemption: 1,000 Boli** (MVR 10).
- **Maximum per order: 30% of subtotal.**
- **Redemption requires at least one delivered order on the account.** See §6.1 — this is the primary anti-fraud control and must be enforced server-side at order creation, not just hidden in the UI.
- Not combinable with a percentage promo code — single config flag `ALLOW_STACKING_WITH_PROMO` (default `false`).
- Spend **FIFO by expiry date**, soonest-expiring first.
- Boli have no cash value, are **non-transferable between accounts**, and are voided on fraud.

### 4.4 Expiry
- Game-earned Boli: **60 days**.
- Purchase-earned Boli: **12 months**.
- A daily scheduled job writes negative ledger entries with reason `expired` and recomputes cached balances.
- Warn the user in-app when Boli expire within 14 days. One email at 7 days, maximum once per fortnight — do not become a nuisance.

---

## 5. The mini-game: Boli Dive

### 5.1 Mechanic

Three cowrie shells resting on wet sand. The user scratches the sand off **one** shell with a finger. The shell opens revealing a Boli amount. Then **the two unchosen shells fade open to show what they held.**

That last beat is the most important sentence in this document. Do not cut it, do not gate it behind a button. A player who sees they walked past 1,000 Boli comes back tomorrow; a player who only sees their own 25 does not.

One play per day. The whole interaction is about four seconds.

### 5.2 Payout table

| Outcome | Weight | Boli | MVR |
|---|---|---|---|
| Common | 62% | 25 | 0.25 |
| Uncommon | 25% | 50 | 0.50 |
| Rare | 10% | 100 | 1.00 |
| Epic | 2.5% | 250 | 2.50 |
| Treasure | 0.5% | 1,000 | 10.00 |

Expected value ≈ **49 Boli/day**. Never zero — the lowest outcome must still feel like a small win.

The two unchosen shells are rolled from the same table independently and are **purely cosmetic** — never credited, never touch the ledger. Weight them slightly upward (shift ~15% of the Common mass into Rare/Epic) so near-misses land more often than true chance. This is presentation, and it costs nothing.

**Pity counter:** if the user's last 10 plays were all Common, force the next roll to be at least Rare.

### 5.3 Streak — the Dhoni Trail

- Consecutive-day plays build a streak.
- **Day 3 onward: 1.25× multiplier** on the payout.
- **Day 7: +100 Boli chest**, then the counter resets to 1 and can be earned again the following week.
- Missing a day resets to 0, except **one streak shield per calendar month** auto-absorbs a single missed day. Surface it warmly when it fires — "your shield caught that one."
- Visual: a 7-island SVG map, a dhoni animating from island N to N+1 on each consecutive play, treasure chest on island 7. GSAP path animation.

### 5.4 Golden Shell days

One day per week, **all three shells pay 1.5×**. The user discovers it on opening the game — gold-tinted sand, a small "Golden Shell day" ribbon.

Determined server-side and deterministically: `goldenWeekday = hash(isoWeekNumber + GOLDEN_SALT) % 7`. Identical for every user, unpredictable week to week, reproducible in tests. **Never announced in advance and never present in any client payload before the day arrives.**

This is the main defence against a pure-luck game going stale. Keep it.

### 5.5 Hard spend caps — non-negotiable

Three independent ceilings, all enforced server-side, all in config:

| Cap | Default | Behaviour on hit |
|---|---|---|
| `WEEKLY_GAME_BOLI_CAP` | 600 | Clamp payout to remaining allowance |
| `MONTHLY_GAME_BOLI_CAP` | 1,800 | Clamp payout to remaining allowance |
| `GLOBAL_DAILY_GAME_BOLI_BUDGET` | 50,000 | Store-wide. All payouts drop to Common tier and an alert fires |

Week and month boundaries are computed in **Asia/Male**. When a cap clamps a payout, still show a positive result — never tell the user they've been cut off mid-animation. Log the clamp.

`GAME_ENABLED` (default `true`) is a **kill switch**: flip it and the game disappears from the UI and the endpoint returns a friendly "back tomorrow" without a deploy. Build it now, before you need it.

### 5.6 Cost model — include this verbatim as a comment in the config file

```
// Boli Dive cost model (1 Boli = MVR 0.01)
//   Base EV ................ ~49 Boli/day  = MVR 0.49
//   Perfect week (7 plays, 1.25x from day 3, +100 chest, one 1.5x golden day)
//                    ....... ~600 Boli/wk  = MVR 6.00
//   Weekly cap ............. 600 Boli      = MVR 6.00   (hard ceiling)
//   Monthly cap ............ 1,800 Boli    = MVR 18.00  (hard ceiling)
//   100 fully engaged players ............ ~MVR 1,800/month worst case
//
// Actual cost is materially lower than the above because:
//   (a) game Boli cannot be redeemed without a delivered order (see 6.1)
//   (b) game Boli expire at 60 days; breakage on daily-reward currencies
//       typically runs high
// Track real issuance vs. real redemption on the admin dashboard before
// raising any number here.
```

---

## 6. Fraud, abuse and financial risk

Treat every item in this section as a requirement with a test.

### 6.1 Multi-accounting — the primary threat

One person, thirty accounts, thirty plays a day. Controls, in order of importance:

1. **No redemption without a delivered order.** An account with zero delivered orders cannot redeem a single Boli, regardless of balance. Enforced server-side at order creation. This makes farming economically pointless — a farmed account can accumulate forever and never cash out without a real purchase to a real address. **This is the control that matters most; implement it first and never weaken it.**
2. **Verified email required** before the game unlocks. Block known disposable-email domains from a maintained list.
3. **Phone (SMS OTP) verification required** before the game unlocks, if the site already has SMS capability. If it does not, leave the hook and a `REQUIRE_PHONE_FOR_GAME` flag defaulting to `false`, and note it in the README — do not build an SMS provider integration as part of this work.
4. **Device signal.** Store a coarse device hash (canvas + UA + screen + timezone) on signup and on each play. Do not block on it. Flag accounts sharing a device hash for admin review.
5. **IP is a weak signal in the Maldives.** Heavy CGNAT means an entire island can share one address. **Never hard-block on IP.** Use it only to flag for review, and only at high thresholds (10+ accounts).
6. **Bot signup:** put Cloudflare Turnstile (or the existing equivalent, if one is already on the site) on the registration form.
7. **Boli are non-transferable.** No gifting, no pooling, no admin-facing transfer between accounts.

### 6.2 Refund and chargeback abuse

The loop to close: buy → earn Boli → spend Boli → refund the order.

- Credit purchase Boli only on `delivered`.
- On refund or cancellation, write a **negative ledger entry** clawing back what that order earned.
- **The ledger may go negative.** Display balance as `max(0, actual)` but store the true figure, and **block all redemption while the true balance is below zero**, showing a neutral "account adjustment pending — contact us" message. Silently clamping at zero leaves the exploit open.
- Boli that were *spent* on a refunded order are returned to the user. The cash refunded is the cash actually paid, excluding the Boli discount.
- Flag any account with 3+ refunds in 90 days for review and suspend its game access pending that review.

### 6.3 Concurrency and replay

- **One play per day**, enforced by a **unique DB constraint** on `(user_id, play_date)` where `play_date` is the date in **Asia/Male (UTC+5)**, not by an application-level `if`.
- Every credit carries a unique idempotency key — `dive:{userId}:{playDate}`, `order:{orderId}:delivered`, `streak:{userId}:{weekEndDate}` — with a **unique index** on the column. A retried webhook or a double-tapped button must never double-credit.
- Redemption at checkout takes a **row-level lock** on the user (`SELECT … FOR UPDATE`) or runs at serializable isolation. Two concurrent checkouts must never spend the same Boli twice.
- **Write tests that prove both**: fire N concurrent play requests and assert exactly one payout; fire two concurrent redemptions of the full balance and assert exactly one succeeds.

### 6.4 Client trust — assume every client is hostile

- **The server rolls the outcome.** The client sends `play` and receives a result. It never sends an amount, never computes a roll, never decides a payout.
- **Boli are credited at roll time**, in the same transaction. The scratch animation presents an already-settled fact. Closing the tab mid-scratch does not forfeit anything; reloading shows the same result and the same three shells — **persist the decoy outcomes** so the reveal is stable.
- Guess/play counts, streaks, multipliers and balances live in the database. Client state is never authoritative.
- Validate every redemption input server-side: positive integer, ≤ true balance, ≥ minimum, ≤ 30% cap, account eligible per 6.1. Reject non-integers, negatives and overflow explicitly.
- A determined user can read the day's result from the network tab before the animation ends. That is acceptable — they cannot change it or replay it.

### 6.5 Rate limiting
- Play endpoint: 10 req/min/user, 60 req/min/IP.
- Redemption preview: 30 req/min/user.
- Registration: 5/hour/IP — with the CGNAT caveat, make this generous and alert rather than block hard.

### 6.6 Admin integrity
- Any manual Boli adjustment writes a ledger row with the **acting admin's user id** and a required reason string. No unattributed adjustments, ever.
- Admin adjustments above a configurable threshold require a second admin's approval.

### 6.7 Terms
Generate a `/terms/boli` page covering: no cash value, non-transferable, expiry periods, the delivered-order requirement for redemption, the right to void balances obtained through abuse, and the right to modify or end the programme with 30 days' notice. Link it from the account tab and the checkout widget.

---

## 7. Data model

Additive only — new tables plus new nullable columns on `users`. Do not alter existing order or product tables beyond a nullable link for redemptions.

- `users` — add `boli_balance_cached`, `boli_tier`, `boli_lifetime_earned`, `has_seen_dive_intro`, `game_access_suspended`, `device_hash`, `wallet_address` (nullable, unused — see §11), `referral_code`, `referred_by`
- `boli_ledger` — id, user_id, `delta` (**bigint**), reason enum, source_type, source_id, `idempotency_key` (**unique index**), `sequence` (bigint, monotonic per user), `prev_hash`, `entry_hash`, expires_at, created_by_admin_id (nullable), admin_reason (nullable), created_at

**All Boli amounts are `bigint`, everywhere — schema, API, business logic.** Never a float, never a JS `number` in a code path that touches a balance. Use `BigInt` in TypeScript and the ORM's bigint type. This is not negotiable and not a style preference; see §11.
- `boli_dive_plays` — id, user_id, `play_date` (**unique with user_id**), outcome_tier, base_payout, streak_multiplier, golden_multiplier, cap_clamped_amount, final_payout, decoy_outcomes (jsonb), streak_day, device_hash, ip_hash, created_at
- `boli_streaks` — user_id, current_streak, longest_streak, last_play_date, shield_month_used, total_plays
- `boli_redemptions` — id, user_id, order_id, boli_spent, mvr_value, created_at
- `boli_fraud_flags` — id, user_id, flag_type enum, detail (jsonb), status enum, created_at, resolved_at, resolved_by

Indexes: `boli_ledger(user_id, expires_at)` for FIFO spend and the expiry sweep; `boli_ledger(created_at, reason)` for the admin dashboard; `boli_dive_plays(device_hash)` for multi-account detection.

---

## 8. Admin dashboard

A page behind existing admin auth showing, at minimum:

- **Total outstanding Boli** and its MVR liability — the headline number.
- Issuance this week/month, split purchase vs. game.
- Redemption this week/month, and redemption rate as a % of issuance.
- **Breakage** — Boli expired unredeemed.
- Top 20 earners by game Boli, with device-hash collision counts.
- Open fraud flags with a resolve action.
- Live toggles for `GAME_ENABLED` and the three caps.

**Alerts** (email or existing notification channel) when: daily global game issuance exceeds 80% of budget; any account exceeds 90% of its weekly cap; redemption in a day exceeds 3× the trailing 30-day average; a device hash accumulates 5+ accounts.

---

## 9. Implementation notes for the scratch canvas

The one place this build can go technically wrong.

- **Pointer events only** (`pointerdown`/`pointermove`/`pointerup`). Set `touch-action: none` on the canvas and register the move listener with `{ passive: false }`, or the page scrolls under the user's finger.
- Scale by `devicePixelRatio` and re-scale on resize and orientation change, or the sand is blurry on every phone.
- Erase with `globalCompositeOperation = 'destination-out'`, round caps and joins, brush radius ~18 CSS px. **Interpolate between pointer samples** — raw `pointermove` skips on slower devices and leaves a dotted trail instead of a stroke.
- **Coverage detection:** sample `getImageData` alpha on a coarse grid (every 8th pixel) throttled to ~150ms. Full-resolution per-frame sampling drops frames on mid-range Android.
- At **40% cleared**, auto-complete — animate the remaining sand away with GSAP rather than making the user finish.
- Reveal: shell splits, amount scales on an elastic ease, small shell-fragment particle burst. Soft chime, **muted by default**, with a persisted toggle.
- **`prefers-reduced-motion`:** skip scratching entirely — three shells, tap one, straight fade to result.
- **Accessibility:** the three shells are real focusable `<button>` elements with `aria-label`s. Keyboard and screen-reader users tap to reveal with no scratching. The canvas is progressive enhancement over working buttons, not the only path. Announce the result in an `aria-live` region.

**Post-play state:** the result stays visible, the Dhoni Trail shows the boat's new position, a **live countdown to midnight MVT** runs, and a quiet link to the shop sits below — this is the moment to turn attention into a browsing session.

**Onboarding:** one small dismissible card on first visit — two sentences of cowrie-shell history, one line on how to play. Store `has_seen_dive_intro`. Do not build a multi-screen tutorial for a four-second game.

---

## 10. Build phases

**Phase 1 — currency foundation and controls**
1. Schema migration and models
2. Ledger service — `credit()`, `debit()`, `getBalance()`, `spendFIFO()` — idempotent and transactional
3. Order-delivered credit hook, plus refund clawback with the negative-balance redemption block
4. Checkout redemption: server-side validation, row lock, delivered-order eligibility check, 30% cap
5. `/account/boli` "My Boli" section, header chip
6. Expiry cron plus a `verify-balances` reconciliation script asserting cache == sum(ledger)
7. `/terms/boli`
8. **Tests:** concurrent double-credit, concurrent double-spend, refund clawback into negative, FIFO expiry order, 30% cap, redemption blocked with zero delivered orders
9. Seed script for fake balances and orders

**Phase 2 — Boli Dive**
1. Roll engine as pure functions with an injectable seeded RNG: weighted table, pity counter, streak multiplier, Golden Shell day, all three caps. Fully unit tested — assert the empirical distribution over 100k seeded rolls matches the table within tolerance.
2. `playToday` server action (transactional, idempotent) and `getTodaysPlay` for resume
3. Scratch canvas, three shells, reduced-motion and keyboard fallbacks
4. Reveal animation and the near-miss reveal
5. Dhoni Trail, shield logic, post-play countdown
6. Rate limiting, device-hash capture, fraud flag writes
7. Concurrency test proving exactly one payout per day

**Phase 3 — admin and monitoring**
1. Admin dashboard and alerts
2. Fraud flag review queue
3. Live config toggles

**Phase 4 (later)** — referrals, review rewards, birthday and profile bonuses. Referral credit pays only after the referee's first **delivered** order to a **different delivery address**.

---

## 11. Forward compatibility

Boli may, much later, become a transferable digital asset. **Do not build any blockchain, token, wallet or on-chain component now.** None of it. Boli today is a closed-loop store credit and nothing else.

But four decisions cost nothing now and would be painful to retrofit. Implement exactly these and no more:

**11.1 — Integer base units, always.** Every Boli amount is a `bigint`. No floats, no `number`, anywhere in the stack, including JSON payloads (serialise as strings). Financial ledgers should be integer-only regardless; it also happens to be how every token standard represents balances.

**11.2 — Declare the decimal convention.** Add `export const BOLI_DECIMALS = 6` to the config with a comment: today 1 Boli is the smallest indivisible unit; if Boli is ever represented in a system requiring subdivision, one Boli equals `10 ** BOLI_DECIMALS` base units. Nothing reads this constant yet. It exists so that a future conversion is a single multiplication rather than a schema migration.

**11.3 — Hash-chain the ledger.** Each `boli_ledger` row stores `prev_hash` (the `entry_hash` of that user's previous entry, or a genesis constant) and `entry_hash` = SHA-256 over a canonical serialisation of `(user_id, sequence, delta, reason, source_type, source_id, prev_hash, created_at)`. Build a `verify-chain` script alongside `verify-balances` that walks each user's chain and reports any break.

This costs roughly twenty lines and buys three things immediately, independent of any token plan: tamper-evidence on the balance history, a defensible audit trail in a customer dispute, and detection of any direct database write that bypassed the ledger service. It is also structurally what a distributed ledger provides, so the accounting model would carry over unchanged.

**11.4 — Track supply from day one.** The admin dashboard records `total_ever_issued`, `total_ever_redeemed`, `total_ever_expired`, and `circulating = issued − redeemed − expired`, each split by source (purchase / game / bonus / admin). Never derive these from a running counter — compute them from the ledger.

Loyalty points are minted on demand and indefinitely; transferable assets need a credible supply history and usually a cap. If that conversation ever happens, the first question asked will be "how much has been issued and on what schedule," and the only way to answer it is to have been recording it from the start.

**Also add** a nullable, entirely unused `wallet_address` column on `users`. One column, zero code paths, saves a migration on a live table later.

**Explicitly out of scope right now:** any smart contract, any chain integration, any wallet connect, any transfer-between-users feature, any exchange or market-price logic, any reference to Boli as a currency, token, coin or investment in user-facing copy. Boli is store credit with no cash value (§4.3, §6.7) and every string in the UI must be consistent with that.

---

## 12. Explicitly not wanted

- Client-side rolling, or any client-submitted payout, streak, multiplier or balance
- A mutable balance column as the single source of truth
- Boli credited at checkout rather than at delivery
- Silently clamping a clawback at zero instead of blocking redemption on a negative true balance
- Redemption permitted on an account with no delivered order
- Hard-blocking users by IP address
- Re-rolling on reload — the day's result is settled at first play
- Cutting the near-miss reveal
- Announcing Golden Shell days in advance or leaking them into any early client payload
- Dark patterns: purchase countdown pressure, fake scarcity, loss-framing that shames a broken streak
- Any refactor of existing site code
- Over-engineering the game. This is a four-second interaction — the complexity belongs in the ledger and the fraud controls, not the canvas.
