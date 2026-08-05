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
