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
