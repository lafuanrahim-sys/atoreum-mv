-- =============================================================================
-- Gift vouchers — prepaid store credit, denominated in Sangu, redeemable by
-- anyone holding the code (including a guest with no account).
--
-- A voucher is a BEARER instrument, which makes it the most abusable thing in
-- this codebase. Every rule that protects it is enforced here rather than in
-- TypeScript, for the same reason boli_ledger is: a bearer token needs one
-- authority, and a check that lives in a server action is a check that a
-- second call site can forget. Application code never UPDATEs gift_vouchers
-- directly — it calls the functions at the bottom of this file.
--
-- The threat model, and the answer to each:
--
--   Redeem a voucher that was never paid for.
--     Issued 'pending'. Only voucher_activate() makes it spendable, and that
--     is called from the order's transition to Confirmed — the same gate that
--     releases the receipt email. A bank transfer with a junk receipt gets a
--     code that buys nothing.
--
--   Spend the same voucher twice, concurrently.
--     Every function locks the voucher row FOR UPDATE before reading the
--     balance. Two checkouts racing the same code queue up; the second sees
--     the balance the first left behind.
--
--   Replay one redemption to drain the balance.
--     Redemptions are unique per (voucher, order). A retried call returns the
--     original row instead of spending again.
--
--   Spend more than the voucher holds.
--     A check constraint, not a comparison in application code:
--     balance_boli between 0 and face_value_boli. Postgres rejects the write
--     even if every layer above it is wrong.
--
--   Cancel the order and keep the goods, or double-refund the buyer.
--     voucher_reverse() puts the exact amount back on the VOUCHER, not into
--     anyone's Sangu balance. The recipient keeps the gift they were given,
--     the buyer is not paid twice, and the store is not out the discount.
--
--   Fund a voucher from a Sangu balance, turning game winnings into an
--   anonymous bearer token.
--     Not expressible: there is no function here that debits boli_ledger to
--     create a voucher. Vouchers are created against a paid order, full stop.
-- =============================================================================

create table if not exists gift_vouchers (
  id uuid primary key default gen_random_uuid(),

  -- The bearer secret. Unique, high-entropy, generated in application code
  -- (see lib/vouchers/code.ts). Stored as given so the buyer can reopen their
  -- order and resend it; it is never exposed by any listing that is not
  -- gated to the buyer or an admin.
  code text not null unique,

  -- Who paid, and on which order. purchaser_user_id is where an expired
  -- remainder goes home to, so it is required and never changes.
  purchaser_user_id text not null,
  order_id text not null,

  face_value_boli bigint not null check (face_value_boli > 0),
  balance_boli bigint not null,

  --   pending    paid for but not yet confirmed — cannot be redeemed
  --   active     confirmed, has balance
  --   exhausted  spent down to zero (can return to active if an order is
  --              cancelled — see voucher_reverse)
  --   expired    remainder returned to the purchaser
  --   void       cancelled by an admin
  status text not null default 'pending'
    check (status in ('pending', 'active', 'exhausted', 'expired', 'void')),

  activated_at timestamptz,
  expires_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- The invariant that matters most. Everything above can be wrong; a
  -- voucher still cannot go negative or grow past what was paid for.
  constraint gift_vouchers_balance_in_range
    check (balance_boli >= 0 and balance_boli <= face_value_boli)
);

create index if not exists gift_vouchers_purchaser_idx on gift_vouchers (purchaser_user_id);
create index if not exists gift_vouchers_order_idx on gift_vouchers (order_id);
create index if not exists gift_vouchers_status_idx on gift_vouchers (status);

-- One voucher per order line. A retried activation must not mint a second.
create unique index if not exists gift_vouchers_order_unique on gift_vouchers (order_id);

-- Append-only history. gift_vouchers.balance_boli is a cache over this, the
-- same relationship stock_on_hand has with stock_movements.
create table if not exists gift_voucher_events (
  id uuid primary key default gen_random_uuid(),
  voucher_id uuid not null references gift_vouchers (id) on delete cascade,
  kind text not null check (kind in ('issued', 'activated', 'redeemed', 'reversed', 'expired', 'voided')),
  -- Signed, in Sangu: negative spends, positive returns. Zero for events that
  -- move status without moving value.
  delta_boli bigint not null default 0,
  order_id text,
  -- Who redeemed, when there is no account to point at: the name, email and
  -- phone given at checkout. This is the whole record of a guest redemption.
  redeemer jsonb,
  note text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists gift_voucher_events_voucher_idx on gift_voucher_events (voucher_id, created_at);

-- Idempotency for redemption and its reversal: one of each per order.
create unique index if not exists gift_voucher_events_redeem_unique
  on gift_voucher_events (voucher_id, order_id) where kind = 'redeemed';
create unique index if not exists gift_voucher_events_reverse_unique
  on gift_voucher_events (voucher_id, order_id) where kind = 'reversed';


-- =============================================================================
-- Functions. Application code calls these and nothing else.
-- =============================================================================

-- Make a paid-for voucher spendable. Called on the purchase order's
-- transition to Confirmed. Idempotent: confirming twice is a no-op.
create or replace function voucher_activate(
  p_order_id text,
  p_valid_days integer default 365
) returns gift_vouchers
language plpgsql
set search_path = public, extensions
as $$
declare
  v gift_vouchers;
begin
  select * into v from gift_vouchers where order_id = p_order_id for update;
  if not found then
    return null;
  end if;
  if v.status <> 'pending' then
    return v; -- already activated (or voided) — nothing to do
  end if;

  update gift_vouchers
     set status = 'active',
         activated_at = now(),
         expires_at = now() + make_interval(days => p_valid_days),
         updated_at = now()
   where id = v.id
   returning * into v;

  insert into gift_voucher_events (voucher_id, kind, order_id, note)
    values (v.id, 'activated', p_order_id, 'payment confirmed');

  return v;
end;
$$;

-- Spend against a voucher. Returns the amount actually taken, which is
-- capped at the balance -- the caller asks for what the order needs and
-- takes what is there, so an over-ask can never overdraw.
create or replace function voucher_redeem(
  p_code text,
  p_order_id text,
  p_want_boli bigint,
  p_redeemer jsonb
) returns bigint
language plpgsql
set search_path = public, extensions
as $$
declare
  v gift_vouchers;
  v_existing gift_voucher_events;
  v_take bigint;
begin
  if p_want_boli <= 0 then
    raise exception 'voucher_redeem: amount must be positive';
  end if;

  select * into v from gift_vouchers where code = p_code for update;
  if not found then
    raise exception 'voucher_redeem: no such voucher';
  end if;

  -- After the lock, not before: two callers with the same order both queue
  -- here, and the second finds the first one's row rather than racing it.
  select * into v_existing
    from gift_voucher_events
   where voucher_id = v.id and order_id = p_order_id and kind = 'redeemed';
  if found then
    return -v_existing.delta_boli; -- already applied; idempotent
  end if;

  if v.status = 'pending' then
    raise exception 'voucher_redeem: voucher is not active yet';
  end if;
  if v.status in ('expired', 'void') then
    raise exception 'voucher_redeem: voucher is % ', v.status;
  end if;
  if v.expires_at is not null and v.expires_at <= now() then
    raise exception 'voucher_redeem: voucher has expired';
  end if;
  if v.balance_boli <= 0 then
    raise exception 'voucher_redeem: voucher has no balance left';
  end if;

  v_take := least(p_want_boli, v.balance_boli);

  update gift_vouchers
     set balance_boli = balance_boli - v_take,
         status = case when balance_boli - v_take = 0 then 'exhausted' else 'active' end,
         updated_at = now()
   where id = v.id;

  insert into gift_voucher_events (voucher_id, kind, delta_boli, order_id, redeemer)
    values (v.id, 'redeemed', -v_take, p_order_id, p_redeemer);

  return v_take;
end;
$$;

-- Put a cancelled order's spend back ON THE VOUCHER. Not into anyone's Sangu
-- balance: the recipient was given this value and keeps it, and the buyer is
-- not made whole for something that was never consumed.
create or replace function voucher_reverse(p_order_id text)
returns bigint
language plpgsql
set search_path = public, extensions
as $$
declare
  v gift_vouchers;
  v_redeem gift_voucher_events;
  v_amount bigint;
begin
  select e.* into v_redeem
    from gift_voucher_events e
   where e.order_id = p_order_id and e.kind = 'redeemed'
   limit 1;
  if not found then
    return 0; -- nothing was spent on this order
  end if;

  select * into v from gift_vouchers where id = v_redeem.voucher_id for update;

  perform 1 from gift_voucher_events
   where voucher_id = v.id and order_id = p_order_id and kind = 'reversed';
  if found then
    return 0; -- already reversed; idempotent
  end if;

  v_amount := -v_redeem.delta_boli;

  -- An expired or voided voucher is not resurrected by a late cancellation:
  -- the value returns to the purchaser instead, handled by the caller.
  if v.status in ('expired', 'void') then
    insert into gift_voucher_events (voucher_id, kind, delta_boli, order_id, note)
      values (v.id, 'reversed', 0, p_order_id, 'order cancelled after voucher closed — returned to purchaser instead');
    return v_amount;
  end if;

  update gift_vouchers
     set balance_boli = balance_boli + v_amount,
         status = 'active',
         updated_at = now()
   where id = v.id;

  insert into gift_voucher_events (voucher_id, kind, delta_boli, order_id, note)
    values (v.id, 'reversed', v_amount, p_order_id, 'order cancelled');

  return 0; -- fully handled on the voucher; caller owes nobody anything
end;
$$;

-- Close an expired voucher and hand its remainder back to whoever paid for
-- it, as Sangu. Runs inside one transaction with the ledger write so a
-- voucher can never be closed without the credit landing.
create or replace function voucher_expire(p_voucher_id uuid)
returns bigint
language plpgsql
set search_path = public, extensions
as $$
declare
  v gift_vouchers;
  v_remainder bigint;
begin
  select * into v from gift_vouchers where id = p_voucher_id for update;
  if not found then
    raise exception 'voucher_expire: no such voucher';
  end if;
  if v.status not in ('active', 'exhausted') then
    return 0; -- already closed
  end if;

  v_remainder := v.balance_boli;

  update gift_vouchers
     set balance_boli = 0, status = 'expired', updated_at = now()
   where id = v.id;

  insert into gift_voucher_events (voucher_id, kind, delta_boli, note)
    values (v.id, 'expired', -v_remainder, 'remainder returned to purchaser');

  if v_remainder > 0 then
    perform boli_ledger_write(
      p_user_id => v.purchaser_user_id,
      p_delta => v_remainder,
      p_reason => 'admin_adjustment',
      p_source_type => 'admin',
      p_source_id => v.id::text,
      p_idempotency_key => 'voucher_remainder:' || v.id::text,
      p_expires_at => null,
      p_created_by_admin_id => null,
      p_admin_reason => 'unused gift voucher remainder returned'
    );
  end if;

  return v_remainder;
end;
$$;
