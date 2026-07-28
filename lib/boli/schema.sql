-- =============================================================================
-- Boli loyalty currency — Supabase/Postgres schema
-- =============================================================================
-- Run this once in the Supabase SQL editor (or `supabase db push` if you use
-- the CLI) against the project referenced by SUPABASE_URL. Idempotent: safe
-- to re-run (uses IF NOT EXISTS / OR REPLACE throughout).
--
-- BOLI-ASSUMPTION (cross-store boundary): the rest of this site's data
-- (users, orders, products...) lives in flat JSON files under /data, not in
-- this database (see lib/data/*.server.ts). Postgres has no way to declare a
-- real foreign key into a JSON file, so every reference to an existing user
-- or order below is a plain TEXT column holding that store's existing string
-- id (e.g. "usr-mrxxvibt", "ord-ms1zjt2i"). `boli_users` is a 1:1 "bridge"
-- table keyed by the existing user id — it stands in for the "add nullable
-- columns to users" instruction in BOLI_SPEC.md §7, which isn't literally
-- possible against a JSON file.
--
-- BOLI-ASSUMPTION (order status): this codebase's OrderStatus enum
-- (lib/types.ts) has no "delivered" state. The closest equivalent is
-- "Completed" — every "on delivered" rule in the spec is implemented against
-- the order transitioning to Completed, and every "on refund/cancellation"
-- rule against a transition to Cancelled. See app/actions/orders.ts.
-- =============================================================================

create extension if not exists pgcrypto; -- gen_random_uuid(), digest()

-- -----------------------------------------------------------------------------
-- 1. boli_users — 1:1 extension of the existing (JSON-file) user record.
-- -----------------------------------------------------------------------------
create table if not exists boli_users (
  user_id text primary key,
  boli_balance_cached bigint not null default 0,
  boli_tier text not null default 'faru' check (boli_tier in ('faru', 'vilu', 'kandu', 'thari')),
  boli_lifetime_earned bigint not null default 0,
  -- Redundant, DB-level copy of "has at least one delivered order" (spec
  -- §6.1, the single most important fraud control). Set automatically by
  -- boli_ledger_write() the moment a purchase_earn credit is written — never
  -- set directly by application code, so it can't be forgotten at a new call
  -- site. The TypeScript redemption path checks this independently too
  -- (see lib/boli/ledger.server.ts) — this column is defense in depth, not
  -- the only check.
  has_delivered_order boolean not null default false,
  has_seen_dive_intro boolean not null default false,
  game_access_suspended boolean not null default false,
  device_hash text,
  wallet_address text, -- nullable, unused — forward-compat placeholder only, see spec §11
  referral_code text unique,
  referred_by text references boli_users (user_id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- 2. boli_ledger — the append-only source of truth. Balances are ALWAYS
--    `SUM(delta)` over this table; boli_users.boli_balance_cached is a
--    materialized cache of that sum, never an independent source of truth
--    (see verify-balances.ts, which asserts cache == sum(ledger)).
-- -----------------------------------------------------------------------------
do $$ begin
  create type boli_ledger_reason as enum (
    'purchase_earn',
    'game_earn',
    'streak_chest',
    'redemption',
    'redemption_reversal', -- boli returned when the order that spent them is cancelled/refunded
    'refund_clawback',     -- boli earned by an order that was later cancelled/refunded
    'expired',
    'admin_adjustment'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type boli_source_type as enum ('order', 'dive_play', 'streak', 'redemption', 'expiry', 'admin');
exception when duplicate_object then null; end $$;

create table if not exists boli_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references boli_users (user_id),
  delta bigint not null,
  reason boli_ledger_reason not null,
  source_type boli_source_type not null,
  source_id text,
  idempotency_key text not null unique,
  sequence bigint not null,
  prev_hash text not null,
  entry_hash text not null,
  expires_at timestamptz,
  created_by_admin_id text,
  admin_reason text,
  created_at timestamptz not null default now(),
  constraint boli_ledger_nonzero check (delta <> 0),
  -- Only credit rows can carry an expiry — debits (redemption/expired/
  -- clawback/...) are permanent reductions and never themselves expire.
  constraint boli_ledger_expiry_only_on_credit check (delta > 0 or expires_at is null)
);

create unique index if not exists boli_ledger_user_sequence_idx on boli_ledger (user_id, sequence);
create index if not exists boli_ledger_user_expiry_idx on boli_ledger (user_id, expires_at) where expires_at is not null;
create index if not exists boli_ledger_created_reason_idx on boli_ledger (created_at, reason);
create index if not exists boli_ledger_source_idx on boli_ledger (source_type, source_id);

-- -----------------------------------------------------------------------------
-- 3. Game + streak + redemption + fraud tables (schema now; game logic is
--    Phase 2, but the data model ships in Phase 1 per BOLI_SPEC.md §10).
-- -----------------------------------------------------------------------------
create table if not exists boli_dive_plays (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references boli_users (user_id),
  play_date date not null, -- Asia/Male calendar date
  -- outcome_tier/base_payout hold the DETERMINED tier for the day (the
  -- matched tier for a pair/triple, or the lowest of the 3 picks on a
  -- no-match) — see grid_tiers/picked_indices/match_type below for the
  -- full "pick 3 of 9" board this was derived from.
  outcome_tier text not null check (outcome_tier in ('common', 'uncommon', 'rare', 'epic', 'treasure')),
  base_payout bigint not null,
  streak_multiplier numeric(4, 2) not null default 1,
  golden_multiplier numeric(4, 2) not null default 1,
  -- How much of (base_payout * multipliers) was shaved off by the weekly,
  -- monthly or global-daily cap — 0 when the play wasn't clamped. Reporting
  -- only; final_payout is always the number actually credited.
  cap_clamped_amount bigint not null default 0,
  final_payout bigint not null,
  -- Day-7 Dhoni Trail chest bonus, tracked separately from final_payout so
  -- the UI can present it as its own moment (BOLI_SPEC.md §5.3) and the
  -- admin dashboard can report it distinctly from the scratch payout.
  chest_boli bigint not null default 0,
  -- True when this play's streak continued only because a monthly streak
  -- shield auto-absorbed a missed day (BOLI_SPEC.md §5.3) — lets the UI
  -- surface "your shield caught that one" for exactly this play.
  shield_fired boolean not null default false,
  -- Historical-only: the shell game's two cosmetic decoy rolls. Unused by
  -- the "pick 3 of 9" board mechanic (written as '[]' for new rows) — kept
  -- NOT NULL rather than dropped so old rows stay intact.
  decoy_outcomes jsonb not null,
  streak_day integer not null,
  device_hash text,
  ip_hash text,
  created_at timestamptz not null default now(),
  unique (user_id, play_date)
);

-- The table may already exist from before these columns were added (this
-- file is re-run, not migrated) — ADD COLUMN IF NOT EXISTS makes the new
-- columns land on an existing install the same as a fresh one.
alter table boli_dive_plays add column if not exists chest_boli bigint not null default 0;
alter table boli_dive_plays add column if not exists shield_fired boolean not null default false;
-- The 9-ball board this play was dealt (array of 9 tier strings), which
-- DIVE_PICK_COUNT of those 9 the player chose (0-based indices into
-- grid_tiers), and how those picks resolved — the full record needed to
-- redraw the board on reload and to explain the payout in the admin
-- dashboard. Nullable: absent on rows from the old shell-game mechanic.
alter table boli_dive_plays add column if not exists grid_tiers jsonb;
alter table boli_dive_plays add column if not exists picked_indices jsonb;
alter table boli_dive_plays add column if not exists match_type text;

create index if not exists boli_dive_plays_device_idx on boli_dive_plays (device_hash);

-- Store-wide daily spend ceiling for Boli Dive (BOLI_SPEC.md §5.5,
-- GLOBAL_DAILY_GAME_BOLI_BUDGET) — one row per Asia/Male calendar day,
-- locked FOR UPDATE by boli_dive_play() to serialize the budget check
-- across every concurrent player that day, independent of any single
-- user's boli_users row lock.
create table if not exists boli_daily_game_budget (
  play_date date primary key,
  total_boli_issued bigint not null default 0
);

create table if not exists boli_streaks (
  user_id text primary key references boli_users (user_id),
  current_streak integer not null default 0,
  longest_streak integer not null default 0,
  last_play_date date,
  shield_month_used text, -- 'YYYY-MM' of the month the shield was last consumed
  total_plays integer not null default 0,
  updated_at timestamptz not null default now()
);

create table if not exists boli_redemptions (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references boli_users (user_id),
  order_id text not null,
  boli_spent bigint not null,
  mvr_value numeric(10, 2) not null,
  created_at timestamptz not null default now()
);

create index if not exists boli_redemptions_order_idx on boli_redemptions (order_id);

create table if not exists boli_fraud_flags (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references boli_users (user_id),
  flag_type text not null check (flag_type in ('device_collision', 'ip_collision', 'refund_pattern', 'manual')),
  detail jsonb not null default '{}',
  status text not null default 'open' check (status in ('open', 'reviewing', 'resolved', 'dismissed')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by text
);

create index if not exists boli_fraud_flags_status_idx on boli_fraud_flags (status);

-- boli_runtime_config: live overrides for the handful of Boli Dive numbers
-- the admin dashboard can flip without a deploy (BOLI_SPEC.md §5.5, §8 —
-- GAME_ENABLED and the three spend caps). lib/boli/config.ts stays the
-- single source of DEFAULT values (and everything else Boli reads from it
-- directly, unchanged); a row here overrides one key's default until an
-- admin changes or clears it. See lib/boli/runtimeConfig.server.ts.
create table if not exists boli_runtime_config (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by text
);

-- =============================================================================
-- Functions — every atomic Boli write goes through one of these. Never
-- INSERT into boli_ledger directly from application code: sequence, the
-- hash chain, the cached balance and has_delivered_order all have to move
-- together inside one locked transaction, which only a Postgres function
-- (a single implicit transaction per call) gives us over Supabase's REST
-- layer. See spec §6.3 (concurrency) and §11.3 (hash chain).
-- =============================================================================

-- boli_ledger_write: the single atomic credit/debit primitive.
-- Locks the user's boli_users row (serializing ALL Boli writes for that
-- user — this is the "SELECT ... FOR UPDATE" the spec calls for), assigns
-- the next per-user sequence number and hash-chain link, inserts the ledger
-- row (idempotent on idempotency_key — a retried call is a safe no-op that
-- returns the original row), and updates the cached balance/lifetime-earned/
-- has_delivered_order in the same transaction.
create or replace function boli_ledger_write(
  p_user_id text,
  p_delta bigint,
  p_reason boli_ledger_reason,
  p_source_type boli_source_type,
  p_source_id text,
  p_idempotency_key text,
  p_expires_at timestamptz,
  p_created_by_admin_id text default null,
  p_admin_reason text default null
) returns boli_ledger
language plpgsql as $$
declare
  v_prev_hash text;
  v_sequence bigint;
  v_entry_hash text;
  v_created_at timestamptz := now();
  v_row boli_ledger;
  v_existing boli_ledger;
begin
  if p_delta = 0 then
    raise exception 'boli_ledger_write: delta must not be zero';
  end if;

  insert into boli_users (user_id) values (p_user_id) on conflict (user_id) do nothing;
  perform 1 from boli_users where user_id = p_user_id for update;

  -- Idempotency check happens AFTER the row lock, not before: two
  -- concurrent callers with the same idempotency_key both queue up on the
  -- lock above, and only the second one to actually acquire it will find
  -- the first one's row already inserted here. Checking before the lock
  -- would let both callers pass the "not found" check and race each other
  -- into the unique constraint below instead of getting a clean idempotent
  -- no-op.
  select * into v_existing from boli_ledger where idempotency_key = p_idempotency_key;
  if found then
    return v_existing; -- already applied; idempotent no-op
  end if;

  select sequence, entry_hash into v_sequence, v_prev_hash
    from boli_ledger where user_id = p_user_id
    order by sequence desc limit 1;

  if not found then
    v_sequence := 0;
    v_prev_hash := 'genesis';
  end if;
  v_sequence := v_sequence + 1;

  -- Deliberately NOT including created_at in the hashed material: sequence
  -- + prev_hash already make the chain immutable and gap-free (that's what
  -- tamper-evidence needs), and leaving out a sub-second timestamp means
  -- verify-chain.ts can reconstruct this exact string from JSON-serialized
  -- ledger rows without fighting floating-point round-trip precision on a
  -- microsecond value.
  v_entry_hash := encode(
    digest(
      p_user_id || '|' || v_sequence::text || '|' || p_delta::text || '|' ||
      p_reason::text || '|' || p_source_type::text || '|' || coalesce(p_source_id, '') || '|' ||
      v_prev_hash,
      'sha256'
    ),
    'hex'
  );

  insert into boli_ledger (
    user_id, delta, reason, source_type, source_id, idempotency_key,
    sequence, prev_hash, entry_hash, expires_at, created_by_admin_id, admin_reason, created_at
  ) values (
    p_user_id, p_delta, p_reason, p_source_type, p_source_id, p_idempotency_key,
    v_sequence, v_prev_hash, v_entry_hash, p_expires_at, p_created_by_admin_id, p_admin_reason, v_created_at
  )
  returning * into v_row;

  update boli_users
    set boli_balance_cached = boli_balance_cached + p_delta,
        boli_lifetime_earned = boli_lifetime_earned + (case when p_reason = 'purchase_earn' then p_delta else 0 end),
        has_delivered_order = has_delivered_order or (p_reason = 'purchase_earn'),
        updated_at = now()
    where user_id = p_user_id;

  return v_row;
end;
$$;

-- boli_spendable_lots: FIFO waterfall — for every credit lot (oldest-
-- expiring first), how much of it remains after ALL debits ever recorded
-- for this user are applied against lots in that same order. A closed-form
-- window-function computation, not a loop: for lot i, remaining_i =
-- clamp(cumulative_credit_through_i - total_debited, 0, lot_i_amount).
-- Used by redemption (sum of remaining, live lots only) and by the expiry
-- sweep (remaining of lots whose expiry has already passed).
create or replace function boli_spendable_lots(p_user_id text)
returns table (ledger_id uuid, remaining bigint, expires_at timestamptz)
language sql stable as $$
  with credits as (
    select id, delta, expires_at,
           sum(delta) over (
             order by expires_at asc nulls last, created_at asc, id asc
             rows between unbounded preceding and current row
           ) as cumulative
    from boli_ledger
    where user_id = p_user_id and delta > 0
  ),
  total_debits as (
    select coalesce(sum(-delta), 0)::bigint as total_debited
    from boli_ledger
    where user_id = p_user_id and delta < 0
  )
  select c.id, greatest(0, least(c.delta, c.cumulative - td.total_debited))::bigint as remaining, c.expires_at
  from credits c cross join total_debits td;
$$;

-- boli_redeem: validates and applies a checkout-time redemption. Re-checks
-- (server-side, inside the same lock) everything the caller should already
-- have checked — never trust the caller, per spec §6.4.
create or replace function boli_redeem(
  p_user_id text,
  p_order_id text,
  p_boli_amount bigint,
  p_mvr_value numeric
) returns boli_ledger
language plpgsql as $$
declare
  v_true_balance bigint;
  v_has_delivered boolean;
  v_spendable bigint;
  v_entry boli_ledger;
begin
  if p_boli_amount <= 0 then
    raise exception 'boli_redeem: amount must be positive';
  end if;

  insert into boli_users (user_id) values (p_user_id) on conflict (user_id) do nothing;
  perform 1 from boli_users where user_id = p_user_id for update;

  select boli_balance_cached, has_delivered_order into v_true_balance, v_has_delivered
    from boli_users where user_id = p_user_id;

  if not v_has_delivered then
    raise exception 'boli_redeem: account is not eligible to redeem (no delivered order on file)';
  end if;

  if v_true_balance < 0 then
    raise exception 'boli_redeem: account balance is under review';
  end if;

  select coalesce(sum(remaining), 0) into v_spendable
    from boli_spendable_lots(p_user_id)
    where expires_at is null or expires_at > now();

  if v_spendable < p_boli_amount then
    raise exception 'boli_redeem: insufficient spendable balance (have %, want %)', v_spendable, p_boli_amount;
  end if;

  v_entry := boli_ledger_write(
    p_user_id => p_user_id,
    p_delta => -p_boli_amount,
    p_reason => 'redemption',
    p_source_type => 'redemption',
    p_source_id => p_order_id,
    p_idempotency_key => 'redeem:' || p_order_id,
    p_expires_at => null
  );

  insert into boli_redemptions (user_id, order_id, boli_spent, mvr_value)
    values (p_user_id, p_order_id, p_boli_amount, p_mvr_value)
    on conflict do nothing;

  return v_entry;
end;
$$;

-- boli_expire_user: sweeps every credit lot for one user whose expiry has
-- passed and hasn't already been swept (idempotent per lot via
-- 'expired:{ledger_id}'). Called once per user by the daily cron.
create or replace function boli_expire_user(p_user_id text)
returns integer
language plpgsql as $$
declare
  v_lot record;
  v_count integer := 0;
begin
  perform 1 from boli_users where user_id = p_user_id for update;

  for v_lot in
    select * from boli_spendable_lots(p_user_id)
    where expires_at is not null and expires_at <= now() and remaining > 0
  loop
    perform boli_ledger_write(
      p_user_id => p_user_id,
      p_delta => -v_lot.remaining,
      p_reason => 'expired',
      p_source_type => 'expiry',
      p_source_id => v_lot.ledger_id::text,
      p_idempotency_key => 'expired:' || v_lot.ledger_id::text,
      p_expires_at => null
    );
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

-- boli_dive_play: the single atomic entry point for a Boli Dive play
-- (BOLI_SPEC.md §5, §6.3). Locks the user's boli_users row (serializing
-- every concurrent play attempt for this user — the DB-level guarantee
-- behind "one play per day", on top of the unique (user_id, play_date)
-- index below), re-derives the streak transition and every cap from
-- server-held state rather than trusting anything computed by the caller,
-- and performs the ledger credit(s) in the same transaction.
--
-- The board itself (p_grid_tiers — DIVE_GRID_SIZE independent rolls,
-- pity-boosted if applicable, Golden Shell day already folded into
-- p_is_golden) is dealt in TypeScript by the pure, unit-tested roll engine
-- (lib/boli/diveEngine.ts) before this function is called — that's a
-- deliberate split, not a trust gap: this function is only ever invoked
-- from lib/boli/dive.server.ts (never client-reachable directly). What it
-- does NOT trust blindly is which 3 balls were picked and what that
-- resolves to: p_picked_indices is validated and the match (triple/pair/
-- none) is recomputed here, under lock, from p_grid_tiers itself — along
-- with streak day, shield state, cap remaining and final payout, all
-- re-derived from boli_streaks / boli_dive_plays / boli_daily_game_budget
-- — the same pattern boli_redeem() uses to re-validate eligibility instead
-- of trusting its caller.
--
-- Every tunable number (caps, multipliers, payout table, chest amount,
-- shield count, expiry days) arrives via p_config — a JSON object built
-- from lib/boli/config.ts — so tuning those constants never requires a
-- change here (BOLI_SPEC.md §2).
create or replace function boli_dive_play(
  p_user_id text,
  p_play_date date,
  p_grid_tiers jsonb,
  p_picked_indices jsonb,
  p_is_golden boolean,
  p_device_hash text,
  p_ip_hash text,
  p_config jsonb
) returns boli_dive_plays
language plpgsql as $$
declare
  v_streak boli_streaks;
  v_existing boli_dive_plays;
  v_play boli_dive_plays;
  v_days_since integer;
  v_streak_day integer;
  v_shield_fired boolean := false;
  v_shield_month_used text;
  v_current_month text := to_char(p_play_date, 'YYYY-MM');
  v_streak_multiplier numeric(4, 2);
  v_golden_multiplier numeric(4, 2);
  v_grid_size int := (p_config ->> 'gridSize')::int;
  v_pick_count int := (p_config ->> 'pickCount')::int;
  v_grid_tiers text[];
  v_picked_idx int[];
  v_tier_a text;
  v_tier_b text;
  v_tier_c text;
  v_match_type text;
  v_determined_tier text;
  v_triple_multiplier numeric(4, 2);
  v_base_payout bigint;
  v_raw_payout bigint;
  v_week_start date;
  v_week_end date;
  v_month_start date;
  v_month_end date;
  v_weekly_used bigint;
  v_monthly_used bigint;
  v_remaining_weekly bigint;
  v_remaining_monthly bigint;
  v_dive_payout bigint;
  v_chest_fires boolean;
  v_chest_payout bigint := 0;
  v_global_used bigint;
  v_global_budget bigint := (p_config ->> 'globalDailyBudget')::bigint;
  v_fallback_common bigint := (p_config ->> 'fallbackCommonPayout')::bigint;
  v_game_expiry_days integer := (p_config ->> 'gameExpiryDays')::integer;
  v_expires_at timestamptz := p_play_date::timestamptz + (v_game_expiry_days || ' days')::interval;
  v_week_end_key text;
begin
  insert into boli_users (user_id) values (p_user_id) on conflict (user_id) do nothing;
  perform 1 from boli_users where user_id = p_user_id for update;

  -- Idempotent no-op: a retried/duplicate request for a day already played
  -- returns exactly what the first call produced, never a second roll.
  select * into v_existing from boli_dive_plays where user_id = p_user_id and play_date = p_play_date;
  if found then
    return v_existing;
  end if;

  -- Validate the board and the picks before trusting either — this
  -- function is only ever called from server code, but a bug upstream
  -- must fail loudly here rather than silently mis-price a payout.
  select array(select jsonb_array_elements_text(p_grid_tiers)) into v_grid_tiers;
  select array(select value::int from jsonb_array_elements_text(p_picked_indices) as value) into v_picked_idx;

  if array_length(v_grid_tiers, 1) is distinct from v_grid_size then
    raise exception 'boli_dive_play: grid must have % balls', v_grid_size;
  end if;
  if array_length(v_picked_idx, 1) is distinct from v_pick_count
     or v_picked_idx[1] = v_picked_idx[2] or v_picked_idx[1] = v_picked_idx[3] or v_picked_idx[2] = v_picked_idx[3]
     or v_picked_idx[1] < 0 or v_picked_idx[1] >= v_grid_size
     or v_picked_idx[2] < 0 or v_picked_idx[2] >= v_grid_size
     or v_picked_idx[3] < 0 or v_picked_idx[3] >= v_grid_size then
    raise exception 'boli_dive_play: must pick % distinct valid ball indices', v_pick_count;
  end if;

  -- Match resolution — recomputed here from the board, never trusted from
  -- the caller: all 3 the same tier is a triple, exactly 2 is a pair,
  -- otherwise the lowest of the 3 pays (never zero — BOLI_SPEC.md §5.2's
  -- "the lowest outcome must still feel like a small win", carried over).
  v_tier_a := v_grid_tiers[v_picked_idx[1] + 1]; -- Postgres arrays are 1-indexed; picks are 0-indexed
  v_tier_b := v_grid_tiers[v_picked_idx[2] + 1];
  v_tier_c := v_grid_tiers[v_picked_idx[3] + 1];

  if v_tier_a = v_tier_b and v_tier_b = v_tier_c then
    v_match_type := 'triple';
    v_determined_tier := v_tier_a;
  elsif v_tier_a = v_tier_b or v_tier_a = v_tier_c then
    v_match_type := 'pair';
    v_determined_tier := v_tier_a;
  elsif v_tier_b = v_tier_c then
    v_match_type := 'pair';
    v_determined_tier := v_tier_b;
  else
    v_match_type := 'none';
    select tier into v_determined_tier
      from unnest(array[v_tier_a, v_tier_b, v_tier_c]) as tier
      order by case tier
        when 'common' then 0 when 'uncommon' then 1 when 'rare' then 2 when 'epic' then 3 when 'treasure' then 4
      end
      limit 1;
  end if;

  v_base_payout := ((p_config -> 'payoutTable' -> v_determined_tier) ->> 'boli')::bigint;
  v_triple_multiplier := case when v_match_type = 'triple' then (p_config ->> 'tripleMultiplier')::numeric else 1 end;

  insert into boli_streaks (user_id) values (p_user_id) on conflict (user_id) do nothing;
  select * into v_streak from boli_streaks where user_id = p_user_id for update;

  -- Streak transition — computed here, under lock, from the stored
  -- last_play_date/current_streak, never from a caller-proposed value
  -- (BOLI_SPEC.md §5.3).
  if v_streak.last_play_date is null then
    v_streak_day := 1;
  else
    v_days_since := p_play_date - v_streak.last_play_date;
    if v_days_since = 1 then
      v_streak_day := case when v_streak.current_streak >= (p_config ->> 'streakChestDay')::integer
        then 1 else v_streak.current_streak + 1 end;
    elsif v_days_since = 2
      and (v_streak.shield_month_used is null or v_streak.shield_month_used <> v_current_month) then
      -- Exactly one day missed, and this month's shield hasn't fired yet.
      v_shield_fired := true;
      v_streak_day := case when v_streak.current_streak >= (p_config ->> 'streakChestDay')::integer
        then 1 else v_streak.current_streak + 1 end;
    else
      v_streak_day := 1; -- missed too many days, or the shield is already spent this month
    end if;
  end if;

  v_shield_month_used := case when v_shield_fired then v_current_month else v_streak.shield_month_used end;
  v_chest_fires := v_streak_day = (p_config ->> 'streakChestDay')::integer;

  -- Multipliers and the raw (pre-cap) payout.
  v_streak_multiplier := case when v_streak_day >= (p_config ->> 'streakMultiplierStartDay')::integer
    then (p_config ->> 'streakMultiplier')::numeric else 1 end;
  v_golden_multiplier := case when p_is_golden then (p_config ->> 'goldenMultiplier')::numeric else 1 end;
  v_raw_payout := round(v_base_payout * v_triple_multiplier * v_streak_multiplier * v_golden_multiplier);

  -- Weekly (Mon–Sun) and calendar-month caps, summed from this user's own
  -- already-committed plays — safe to read without a separate lock because
  -- every write that could change this sum for this user goes through the
  -- boli_users row lock already held above.
  v_week_start := p_play_date - (extract(isodow from p_play_date)::integer - 1);
  v_week_end := v_week_start + 6;
  v_month_start := date_trunc('month', p_play_date)::date;
  v_month_end := (date_trunc('month', p_play_date) + interval '1 month' - interval '1 day')::date;

  select coalesce(sum(final_payout + chest_boli), 0) into v_weekly_used
    from boli_dive_plays where user_id = p_user_id and play_date >= v_week_start and play_date <= v_week_end;
  select coalesce(sum(final_payout + chest_boli), 0) into v_monthly_used
    from boli_dive_plays where user_id = p_user_id and play_date >= v_month_start and play_date <= v_month_end;

  v_remaining_weekly := greatest(0, (p_config ->> 'weeklyCap')::bigint - v_weekly_used);
  v_remaining_monthly := greatest(0, (p_config ->> 'monthlyCap')::bigint - v_monthly_used);

  v_dive_payout := least(v_raw_payout, v_remaining_weekly, v_remaining_monthly);
  v_remaining_weekly := v_remaining_weekly - v_dive_payout;
  v_remaining_monthly := v_remaining_monthly - v_dive_payout;

  if v_chest_fires then
    v_chest_payout := least((p_config ->> 'streakChestBoli')::bigint, v_remaining_weekly, v_remaining_monthly);
  end if;

  -- Store-wide daily budget — locked independently of any single user, so
  -- concurrent players on the same day serialize on this row instead of on
  -- boli_users (BOLI_SPEC.md §5.5).
  insert into boli_daily_game_budget (play_date) values (p_play_date) on conflict (play_date) do nothing;
  perform 1 from boli_daily_game_budget where play_date = p_play_date for update;
  select total_boli_issued into v_global_used from boli_daily_game_budget where play_date = p_play_date;

  if v_global_used + v_dive_payout + v_chest_payout > v_global_budget then
    -- "All payouts drop to Common tier" — clamp the dive portion to the
    -- flat Common-tier amount (still bounded by whatever weekly/monthly
    -- room is left) and drop the chest entirely for the rest of the day.
    -- The spec doesn't spell out the chest/budget interaction — this is
    -- the conservative reading. BOLI-ASSUMPTION.
    v_dive_payout := least(v_fallback_common, v_remaining_weekly + v_dive_payout);
    v_chest_payout := 0;
  end if;

  insert into boli_dive_plays (
    user_id, play_date, outcome_tier, base_payout, streak_multiplier, golden_multiplier,
    cap_clamped_amount, final_payout, chest_boli, shield_fired, decoy_outcomes, streak_day,
    device_hash, ip_hash, grid_tiers, picked_indices, match_type
  ) values (
    p_user_id, p_play_date, v_determined_tier, v_base_payout, v_streak_multiplier, v_golden_multiplier,
    greatest(0, v_raw_payout - v_dive_payout), v_dive_payout, v_chest_payout, v_shield_fired,
    '[]'::jsonb, v_streak_day, p_device_hash, p_ip_hash, p_grid_tiers, p_picked_indices, v_match_type
  )
  returning * into v_play;

  if v_dive_payout > 0 then
    perform boli_ledger_write(
      p_user_id => p_user_id,
      p_delta => v_dive_payout,
      p_reason => 'game_earn',
      p_source_type => 'dive_play',
      p_source_id => v_play.id::text,
      p_idempotency_key => 'dive:' || p_user_id || ':' || p_play_date::text,
      p_expires_at => v_expires_at
    );
  end if;

  if v_chest_payout > 0 then
    v_week_end_key := to_char(v_week_end, 'YYYY-MM-DD');
    perform boli_ledger_write(
      p_user_id => p_user_id,
      p_delta => v_chest_payout,
      p_reason => 'streak_chest',
      p_source_type => 'streak',
      p_source_id => v_play.id::text,
      p_idempotency_key => 'streak:' || p_user_id || ':' || v_week_end_key,
      p_expires_at => v_expires_at
    );
  end if;

  update boli_streaks
    set current_streak = v_streak_day,
        longest_streak = greatest(longest_streak, v_streak_day),
        last_play_date = p_play_date,
        shield_month_used = v_shield_month_used,
        total_plays = total_plays + 1,
        updated_at = now()
    where user_id = p_user_id;

  update boli_daily_game_budget
    set total_boli_issued = total_boli_issued + v_dive_payout + v_chest_payout
    where play_date = p_play_date;

  return v_play;
end;
$$;

-- -----------------------------------------------------------------------------
-- Reporting views (spec §11.4 — track supply from day one; the admin
-- dashboard itself is Phase 3, but these are cheap and pure schema).
-- -----------------------------------------------------------------------------
create or replace view boli_supply as
select
  coalesce(sum(delta) filter (where delta > 0), 0)::bigint as total_ever_issued,
  coalesce(sum(-delta) filter (where reason = 'redemption'), 0)::bigint as total_ever_redeemed,
  coalesce(sum(-delta) filter (where reason = 'expired'), 0)::bigint as total_ever_expired,
  coalesce(sum(delta) filter (where reason = 'refund_clawback'), 0)::bigint as total_clawed_back,
  coalesce(sum(delta), 0)::bigint as circulating
from boli_ledger;

create or replace view boli_supply_by_source as
select source_type, reason, sum(delta)::bigint as total_delta, count(*) as entry_count
from boli_ledger
group by source_type, reason
order by source_type, reason;
