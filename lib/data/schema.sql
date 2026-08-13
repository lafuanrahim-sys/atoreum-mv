-- =============================================================================
-- Core storefront schema — products, orders, users, reviews, brands,
-- messages, settings. Migrated off JSON-on-disk (the previous lib/data/*
-- .server.ts implementation) because Vercel's serverless filesystem is
-- read-only/ephemeral at runtime — writes to a JSON file would silently
-- fail or vanish on the next cold start. Lives in the SAME Supabase project
-- as lib/boli/schema.sql (a plain Postgres connection via lib/db.ts, same
-- DATABASE_URL). Run this once via the Supabase SQL editor or
-- `psql "$DATABASE_URL" -f lib/data/schema.sql`. Idempotent: safe to re-run.
--
-- Unlike Boli's ledger (lib/boli/schema.sql), none of these tables need
-- hash chains, idempotency keys, or row-locked stored procedures — they're
-- simple CRUD, so the data-layer functions in lib/data/*.server.ts talk to
-- these tables directly via parameterized SQL rather than through Postgres
-- functions. IDs stay the app's existing string formats (e.g. "usr-...",
-- "ord-...") rather than switching to uuid, so every id already in orders,
-- reviews, favorites, etc. (and every id a customer might have bookmarked
-- in a URL) keeps working unchanged.
-- =============================================================================

create table if not exists products (
  id text primary key,
  sku text not null default '',
  name text not null,
  size text not null default '',
  brand text not null,
  category text not null,
  price numeric(12, 2) not null,
  currency text not null default 'MVR',
  description text not null default '',
  -- Always exactly 3 entries (Product.headlines is a 3-tuple) — enforced in
  -- TypeScript on write, not here; jsonb keeps the migration a direct
  -- structural copy of the JSON it replaces.
  headlines jsonb not null default '["", "", ""]',
  ingredients text not null default '',
  how_to_use text not null default '',
  images jsonb not null default '[]',
  stock_status text not null default 'in-stock' check (stock_status in ('in-stock', 'low-stock', 'out-of-stock')),
  stock_on_hand integer not null default 0,
  featured boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Price band. `price` is the LISTING price -- the number the storefront
-- shows and the number an order is priced from -- and the three columns
-- around it are the band it has to sit in:
--
--   price_min     the floor. What the store will not sell below (landed
--                 cost plus the margin the owner refuses to give up). The
--                 check constraint below is the actual guarantee; the admin
--                 form's `min` attribute is only a courtesy.
--   price_median  the intended shelf price, for reference when pricing
--                 against the band. Advisory: nothing is charged from it.
--   price_max     the ceiling, likewise advisory.
--
-- All three are nullable-by-default-0 rather than required, so every row
-- that existed before this column did stays valid: price_min 0 makes the
-- constraint vacuously true until someone sets a real floor.
alter table products add column if not exists price_min numeric(12, 2) not null default 0;
alter table products add column if not exists price_median numeric(12, 2);
alter table products add column if not exists price_max numeric(12, 2);

-- Percentage off the listing price, 0 when not on offer. Capped at 95 so a
-- slipped decimal cannot hand the shop away; negative is meaningless.
alter table products add column if not exists discount_percent numeric(5, 2) not null default 0;

-- What the customer actually pays. GENERATED, not computed in TypeScript,
-- for the same reason every other money figure in this schema is: there is
-- exactly one definition of the discounted price and the database owns it,
-- so the storefront, the cart and the order total cannot drift from each
-- other or from what the admin thinks the discount was.
alter table products
  add column if not exists price_effective numeric(12, 2)
  generated always as (round(price * (1 - discount_percent / 100), 2)) stored;

-- The constraints. These are the enforcement -- form validation is a
-- convenience that a crafted POST walks straight past.
do $$ begin
  alter table products add constraint products_discount_range
    check (discount_percent >= 0 and discount_percent <= 95);
exception when duplicate_object then null; end $$;

do $$ begin
  alter table products add constraint products_price_at_least_min
    check (price >= price_min);
exception when duplicate_object then null; end $$;

-- Band ordering, only where the optional ends are actually set.
do $$ begin
  alter table products add constraint products_price_band_ordered
    check (
      (price_max is null or price_max >= price_min)
      and (price_median is null or price_median >= price_min)
      and (price_median is null or price_max is null or price_median <= price_max)
    );
exception when duplicate_object then null; end $$;

-- Stock status is DERIVED, not typed in.
--
-- It used to be a free column an admin set by hand, which meant it drifted the
-- moment stock moved: an order deducted the last two units and the product
-- still advertised itself as In Stock until someone remembered to change the
-- dropdown. It is now a generated column over stock_on_hand, so it is a fact
-- about the shelf rather than an opinion recorded at some point in the past:
--
--   0 units      -> out-of-stock
--   1-2 units    -> low-stock          (the owner's threshold)
--   3 or more    -> in-stock
--
-- Postgres cannot ALTER an existing column into a generated one, so the old
-- column is dropped and re-added. Nothing is lost: every value it could have
-- held is recomputed from stock_on_hand, which is itself maintained by the
-- stock_movements ledger.
do $$ begin
  if exists (
    select 1 from information_schema.columns
     where table_name = 'products' and column_name = 'stock_status'
       and is_generated = 'NEVER'
  ) then
    alter table products drop column stock_status;
  end if;
end $$;

alter table products add column if not exists stock_status text
  generated always as (
    case
      when stock_on_hand <= 0 then 'out-of-stock'
      when stock_on_hand <= 2 then 'low-stock'
      else 'in-stock'
    end
  ) stored;

create index if not exists products_category_idx on products (category);
create index if not exists products_featured_idx on products (featured) where featured;

create table if not exists orders (
  id text primary key,
  order_number text not null unique,
  items jsonb not null,
  -- The signed-in account that placed this order, if any (see Order.userId
  -- in lib/types.ts) — no foreign key to users: guest checkouts have none,
  -- and an order must survive the account it was placed under being deleted.
  user_id text,
  subtotal numeric(12, 2) not null,
  currency text not null default 'MVR',
  customer jsonb not null,
  payment_method text,
  payment_proof_path text,
  status text not null default 'Pending Verification'
    check (status in ('Pending Verification', 'Confirmed', 'Shipped', 'Completed', 'Cancelled')),
  boli_redeemed bigint,
  boli_discount_amount numeric(12, 2),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists orders_user_idx on orders (user_id);
create index if not exists orders_created_idx on orders (created_at desc);

create table if not exists users (
  id text primary key,
  name text not null,
  email text not null unique,
  password_hash text not null,
  role text not null default 'customer' check (role in ('customer', 'admin', 'superadmin')),
  favorites jsonb not null default '[]',
  email_verified boolean not null default false,
  verification_token_hash text,
  verification_token_expires_at timestamptz,
  -- Forgot-password flow -- same shape/posture as the verification token
  -- pair above (hash only, never the raw token; short-lived; single use).
  password_reset_token_hash text,
  password_reset_token_expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table users add column if not exists password_reset_token_hash text;
alter table users add column if not exists password_reset_token_expires_at timestamptz;

-- Double-submit guard.
--
-- A client generates one key per checkout attempt and sends it with the
-- order. The unique index means a second submission carrying the same key
-- cannot create a second order, however it arrives -- an impatient second
-- click, a retried request, a back button, a flaky connection replaying the
-- POST. Disabling the button is a courtesy; this is the guarantee.
--
-- Nullable, because every order placed before this existed has no key, and
-- Postgres unique indexes permit many NULLs.
alter table orders add column if not exists idempotency_key text;
create unique index if not exists orders_idempotency_key_idx on orders (idempotency_key)
  where idempotency_key is not null;

-- Invoice numbering.
--
-- A tax invoice number has to be unique for the life of the business. Order
-- numbers cannot supply one: they are ATM-<date>-NNNN and the counter resets
-- every day, so deriving from them would issue ATO-INV-0001 again tomorrow
-- and again the day after. This is its own monotonic sequence, assigned by
-- DEFAULT at insert so no code path can create an order without one.
--
-- Cancelled orders keep their number rather than releasing it. A number that
-- was issued and then reused would let two different documents claim the same
-- reference; gaps in the run are ordinary and explainable, collisions are not.
create sequence if not exists invoice_seq as bigint start 1;
alter table orders add column if not exists invoice_seq bigint;
alter table orders alter column invoice_seq set default nextval('invoice_seq');

-- Existing rows predate the column. Numbered by creation order so the run
-- matches the order the sales actually happened in.
update orders o
   set invoice_seq = n.rn
  from (select id, row_number() over (order by created_at, id) as rn from orders where invoice_seq is null) n
 where o.id = n.id and o.invoice_seq is null;

-- Keep the sequence ahead of anything backfilled above.
select setval('invoice_seq', greatest((select coalesce(max(invoice_seq), 0) from orders), 1));

create unique index if not exists orders_invoice_seq_idx on orders (invoice_seq);

create table if not exists reviews (
  id text primary key,
  product_id text not null,
  user_id text not null,
  user_name text not null,
  rating integer not null check (rating between 1 and 5),
  text text not null default '',
  status text not null default 'pending' check (status in ('pending', 'approved')),
  created_at timestamptz not null default now()
);

create index if not exists reviews_product_status_idx on reviews (product_id, status);

create table if not exists brands (
  name text primary key,
  created_at timestamptz not null default now()
);

create table if not exists messages (
  id text primary key,
  name text not null,
  phone text not null default '',
  message text not null default '',
  -- 'deleted' is a soft delete -- Dashboard -> Messages -> Deleted lists and
  -- can restore these, nothing here is ever hard-deleted from the UI.
  status text not null default 'unread' check (status in ('unread', 'read', 'archived', 'deleted')),
  created_at timestamptz not null default now()
);
-- Existing installs: the inline check above only applies on a fresh create,
-- so widen the constraint on a table that already exists.
alter table messages drop constraint if exists messages_status_check;
alter table messages add constraint messages_status_check
  check (status in ('unread', 'read', 'archived', 'deleted'));

-- Singleton row (id must be `true`, and `true` is the only value the check
-- constraint allows, so a second row is structurally impossible) — mirrors
-- the previous single-JSON-object settings.json exactly.
create table if not exists store_settings (
  id boolean primary key default true check (id),
  bank_name text not null default '',
  account_name text not null default '',
  account_number text not null default '',
  swift text not null default '',
  -- When true, the public storefront shows a "closed for maintenance" page
  -- to everyone except signed-in admins (see app/layout.tsx) -- an
  -- instant, self-service on/off switch for the whole site that doesn't
  -- need a redeploy or Vercel dashboard access.
  maintenance_mode boolean not null default false,
  updated_at timestamptz not null default now()
);
alter table store_settings add column if not exists maintenance_mode boolean not null default false;

-- =============================================================================
-- Dollar exchange tracker (admin-only, Dashboard -> Dollar Exchange). Ported
-- from the standalone Atoreum FX app (originally its own Next.js/Supabase
-- project) directly into this schema/dashboard instead of staying a separate
-- deployment -- same idea, same math, one fewer app to host and sign into.
-- Logs USD bought on the Maldivian parallel market (fx_exchanges) and TT
-- (telegraphic transfer) payments where Bank of Maldives covers part of the
-- transfer in dollars at its own rate (fx_tt_payments). uuid ids (not the
-- rest of this file's app-generated text ids) because these are ledger-style
-- transaction rows, like lib/boli/schema.sql's boli_ledger, not
-- app-addressable resources.
--
-- Every derived figure below is a Postgres generated column, not
-- TypeScript arithmetic -- if a number appears on screen, it came from the
-- database. This is the single most important rule carried over from the
-- original spec: it's what makes the numbers trustworthy for real money.
-- =============================================================================

create extension if not exists pgcrypto; -- gen_random_uuid() -- idempotent even if lib/boli/schema.sql already created it

create table if not exists fx_settings (
  id boolean primary key default true check (id),
  ceiling_rate numeric(10, 4) not null default 20.0000,
  bank_tt_rate numeric(10, 4) not null default 15.4200,
  latest_market_rate numeric(10, 4) not null default 21.6000,
  updated_at timestamptz not null default now(),
  updated_by text
);
insert into fx_settings (id) values (true) on conflict do nothing;

create table if not exists fx_exchanges (
  id uuid primary key default gen_random_uuid(),
  trade_date date not null,
  counterparty text not null,
  usd_amount numeric(14, 4) not null check (usd_amount > 0),
  buy_rate numeric(10, 4) not null check (buy_rate > 0),
  market_rate numeric(10, 4) not null check (market_rate > 0),
  ceiling_rate numeric(10, 4) not null default 20.0000,
  sell_rate numeric(10, 4) check (sell_rate > 0),
  notes text not null default '',
  created_at timestamptz not null default now(),
  created_by text,

  mvr_paid numeric(18, 4) generated always as (usd_amount * buy_rate) stored,
  cost_at_ceiling numeric(18, 4) generated always as (usd_amount * ceiling_rate) stored,
  profit_vs_ceiling numeric(18, 4) generated always as
    (usd_amount * ceiling_rate - usd_amount * buy_rate) stored,
  unrealized_vs_market numeric(18, 4) generated always as
    (usd_amount * (market_rate - buy_rate)) stored,
  -- null until sell_rate is set -- a purchase that hasn't been resold yet.
  realized_profit numeric(18, 4) generated always as
    (usd_amount * (sell_rate - buy_rate)) stored
);
create index if not exists fx_exchanges_trade_date_idx on fx_exchanges (trade_date desc);

-- support_pct is the share of the TT the BANK supplies at its own rate; the
-- remainder is drawn from the company's own USD account at the market rate.
create table if not exists fx_tt_payments (
  id uuid primary key default gen_random_uuid(),
  tt_date date not null,
  reference text not null,
  purpose text not null default '',
  tt_amount numeric(14, 4) not null check (tt_amount > 0),
  support_pct numeric(9, 6) not null check (support_pct >= 0 and support_pct <= 1),
  bank_rate numeric(10, 4) not null check (bank_rate > 0),
  market_rate numeric(10, 4) not null check (market_rate > 0),
  notes text not null default '',
  created_at timestamptz not null default now(),
  created_by text,

  usd_via_bank numeric(18, 4) generated always as (tt_amount * support_pct) stored,
  usd_from_own numeric(18, 4) generated always as (tt_amount * (1 - support_pct)) stored,
  cash_paid_mvr numeric(18, 4) generated always as (tt_amount * support_pct * bank_rate) stored,
  own_usd_at_bank_rate numeric(18, 4) generated always as
    (tt_amount * (1 - support_pct) * bank_rate) stored,
  cost_own_usd_mvr numeric(18, 4) generated always as
    (tt_amount * (1 - support_pct) * market_rate) stored,
  opportunity_cost numeric(18, 4) generated always as
    (tt_amount * (1 - support_pct) * (market_rate - bank_rate)) stored,
  total_effective_cost numeric(18, 4) generated always as
    (tt_amount * support_pct * bank_rate + tt_amount * (1 - support_pct) * market_rate) stored,
  cost_no_support numeric(18, 4) generated always as (tt_amount * market_rate) stored,
  -- algebraically equal to cost_no_support - total_effective_cost
  cash_saved_today numeric(18, 4) generated always as
    (tt_amount * support_pct * (market_rate - bank_rate)) stored,
  -- algebraically equal to cash_saved_today + opportunity_cost
  total_saved_incl_opp numeric(18, 4) generated always as
    (tt_amount * (market_rate - bank_rate)) stored
);
create index if not exists fx_tt_payments_tt_date_idx on fx_tt_payments (tt_date desc);

-- security_invoker: without it this view runs as its owner (postgres) and
-- bypasses RLS on the tables below -- anyone who could query the view would
-- see the totals regardless of the RLS enabled further down this file.
--
-- NOTE inherited from the original app: usd_used subtracts usd_from_own, not
-- usd_via_bank. The source spreadsheet subtracted the bank's own share,
-- which overstated how much the company's own USD account was depleted --
-- only usd_from_own actually leaves that account.
create or replace view fx_dashboard
with (security_invoker = true) as
with ex as (
  select
    coalesce(sum(usd_amount), 0) as usd_bought,
    coalesce(sum(mvr_paid), 0) as mvr_paid,
    coalesce(sum(profit_vs_ceiling), 0) as profit_vs_ceiling,
    coalesce(sum(unrealized_vs_market), 0) as profit_vs_market,
    coalesce(sum(realized_profit), 0) as realized_profit
  from fx_exchanges
),
tt as (
  select
    coalesce(sum(tt_amount), 0) as tt_total,
    coalesce(sum(usd_from_own), 0) as usd_from_own,
    coalesce(sum(cash_paid_mvr), 0) as cash_paid,
    coalesce(sum(cost_no_support), 0) as cost_no_support,
    coalesce(sum(cash_saved_today), 0) as cash_saved,
    coalesce(sum(total_saved_incl_opp), 0) as saved_incl_opp
  from fx_tt_payments
)
select
  ex.usd_bought,
  tt.usd_from_own as usd_used,
  ex.usd_bought - tt.usd_from_own as usd_balance,
  case when ex.usd_bought > 0 then ex.mvr_paid / ex.usd_bought end as avg_buy_rate,
  ex.mvr_paid,
  ex.profit_vs_ceiling,
  ex.profit_vs_market,
  ex.realized_profit,
  tt.tt_total,
  tt.cash_paid,
  tt.cost_no_support,
  tt.cash_saved,
  tt.saved_incl_opp,
  ex.profit_vs_market + tt.saved_incl_opp as total_value_created
from ex, tt;

-- =============================================================================
-- Stock control: shipments in, physical counts, and the movement ledger that
-- reconciles them against what the storefront has actually sold.
--
-- products.stock_on_hand stays the single number everything else reads (the
-- storefront, the low-stock signal, the products table) -- it is a CACHE,
-- the same role boli_users.boli_balance_cached plays for Sangu. The truth
-- is stock_movements: every unit that has ever entered or left, with a
-- reason attached. Before this, stock_on_hand was a bare integer typed in
-- by hand with no record of why it changed, so a wrong number could only
-- ever be re-guessed, never explained.
--
-- Faulty units are deliberately NOT a stock status or a separate pool: they
-- are recorded per shipment line (qty_faulty) and simply never enter
-- sellable stock in the first place -- only qty_good is received. That
-- keeps "how many arrived broken, and what are they worth" answerable per
-- shipment, per product, and in total, without ever risking a damaged unit
-- being sold.
-- =============================================================================

create table if not exists stock_shipments (
  id uuid primary key default gen_random_uuid(),
  -- Supplier invoice, AWB, or whatever the store actually writes on the box.
  reference text not null default '',
  supplier text not null default '',
  shipped_date date,
  received_date date,
  -- draft: lines are still being entered/edited, nothing has touched stock.
  -- received: quantities have been posted to the movement ledger and are
  -- final. The transition happens exactly once (receiveShipment()).
  status text not null default 'draft' check (status in ('draft', 'received')),
  notes text not null default '',
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists stock_shipments_created_idx on stock_shipments (created_at desc);

create table if not exists stock_shipment_items (
  id uuid primary key default gen_random_uuid(),
  shipment_id uuid not null references stock_shipments (id) on delete cascade,
  product_id text not null references products (id) on delete restrict,
  qty_expected integer not null default 0 check (qty_expected >= 0),
  qty_received integer not null default 0 check (qty_received >= 0),
  qty_faulty integer not null default 0 check (qty_faulty >= 0),
  note text not null default '',
  -- The only quantity that ever becomes sellable stock. greatest(...,0) is a
  -- floor for a mis-typed faulty count exceeding received; the form blocks
  -- that case too, but the database is what actually has to hold.
  qty_good integer generated always as (greatest(qty_received - qty_faulty, 0)) stored,
  -- Short by this many against what the supplier was meant to send.
  qty_short integer generated always as (greatest(qty_expected - qty_received, 0)) stored,
  unique (shipment_id, product_id)
);
create index if not exists stock_shipment_items_shipment_idx on stock_shipment_items (shipment_id);
create index if not exists stock_shipment_items_product_idx on stock_shipment_items (product_id);

-- Paperwork for a shipment: supplier invoice, packing list, photos of what
-- arrived damaged. storage_path is a key inside the PRIVATE shipment-files
-- bucket, not a URL -- links are signed at render time and expire (see
-- lib/storage.ts), because these carry supplier pricing.
--
-- Attachments stay editable after a shipment is received, unlike its
-- quantity lines: a credit note or a damage claim usually only arrives
-- after the box has been unpacked and posted to stock.
create table if not exists stock_shipment_files (
  id uuid primary key default gen_random_uuid(),
  shipment_id uuid not null references stock_shipments (id) on delete cascade,
  file_name text not null,
  storage_path text not null,
  content_type text not null default '',
  size_bytes integer not null default 0,
  uploaded_by text,
  created_at timestamptz not null default now()
);
create index if not exists stock_shipment_files_shipment_idx on stock_shipment_files (shipment_id, created_at desc);

create table if not exists stock_counts (
  id uuid primary key default gen_random_uuid(),
  counted_on date not null default current_date,
  status text not null default 'draft' check (status in ('draft', 'applied')),
  notes text not null default '',
  created_by text,
  created_at timestamptz not null default now(),
  applied_at timestamptz
);
create index if not exists stock_counts_created_idx on stock_counts (created_at desc);

-- A count only has to cover the products actually counted -- a full
-- stocktake and a single-shelf spot check are the same shape, just a
-- different number of rows.
create table if not exists stock_count_items (
  id uuid primary key default gen_random_uuid(),
  count_id uuid not null references stock_counts (id) on delete cascade,
  product_id text not null references products (id) on delete restrict,
  -- What the system believed at the moment the line was entered, frozen so
  -- the variance stays meaningful even if a sale lands mid-count.
  system_qty integer not null,
  counted_qty integer not null check (counted_qty >= 0),
  variance integer generated always as (counted_qty - system_qty) stored,
  unique (count_id, product_id)
);
create index if not exists stock_count_items_count_idx on stock_count_items (count_id);

-- Append-only. Never updated, never deleted -- a correction is another row.
create table if not exists stock_movements (
  id uuid primary key default gen_random_uuid(),
  product_id text not null references products (id) on delete cascade,
  -- Signed: positive adds sellable stock, negative removes it.
  delta integer not null check (delta <> 0),
  reason text not null check (reason in (
    'shipment_received',  -- good units from a received shipment
    'count_adjustment',   -- reconciling to a physical count
    'sale',               -- order reached a stock-committed status
    'sale_reversal',      -- that order was later cancelled
    'manual'              -- direct edit on the product form
  )),
  -- What caused it: 'shipment'/'count'/'order'/'product', plus that row's id.
  source_type text not null default '',
  source_id text not null default '',
  note text not null default '',
  created_by text,
  created_at timestamptz not null default now()
);
create index if not exists stock_movements_product_idx on stock_movements (product_id, created_at desc);
create index if not exists stock_movements_source_idx on stock_movements (source_type, source_id);

-- -----------------------------------------------------------------------------
-- Row Level Security. These tables are only ever queried through this app's
-- own backend -- a direct Postgres connection as the `postgres` role (see
-- lib/db.ts), which owns every table here and carries BYPASSRLS, so it's
-- completely unaffected by RLS either way. Nothing in this app ever queries
-- through Supabase's PostgREST/anon-key API. But every public-schema table
-- is auto-exposed via that API regardless of whether the app itself uses
-- it -- Supabase's linter flags exactly this (rls_disabled_in_public,
-- sensitive_columns_exposed on store_settings.account_number). Enabling RLS
-- with zero policies closes that API off entirely (anon/authenticated have
-- no bypass and no policy grants them anything) without touching how the
-- app talks to the database.
alter table products enable row level security;
alter table orders enable row level security;
alter table users enable row level security;
alter table reviews enable row level security;
alter table brands enable row level security;
alter table messages enable row level security;
alter table store_settings enable row level security;
alter table fx_settings enable row level security;
alter table fx_exchanges enable row level security;
alter table fx_tt_payments enable row level security;
alter table stock_shipments enable row level security;
alter table stock_shipment_items enable row level security;
alter table stock_shipment_files enable row level security;
alter table stock_counts enable row level security;
alter table stock_count_items enable row level security;
alter table stock_movements enable row level security;
