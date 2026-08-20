-- Invoice numbers are issued at confirmation, not at checkout.
--
-- They used to be stamped by a BEFORE INSERT trigger, which meant every
-- abandoned basket, every mistyped test order and every unpaid bank transfer
-- burned a tax invoice number. The run filed with MIRA then had holes in it
-- that corresponded to no sale, and no way to explain them.
--
-- A tax invoice is a document about a sale that happened. Until someone has
-- confirmed the money arrived, there is no sale to document, so there is
-- nothing to number. Orders now carry a NULL invoice_seq until they are
-- confirmed, and the run is unbroken because only real sales enter it.

-- The trigger goes. Assignment is now explicit and happens on confirmation.
drop trigger if exists orders_assign_invoice_number_trg on orders;

alter table orders alter column invoice_seq drop not null;

/*
 * Issue this order's invoice number, if it does not have one.
 *
 * Idempotent by design: confirming an already-confirmed order, a double
 * click, or a retried request must not produce a second invoice for one sale.
 * Returns the number in force either way.
 */
create or replace function orders_issue_invoice(p_order_id text)
returns bigint
language plpgsql
as $$
declare
  v_seq    bigint;
  v_series text;
begin
  select invoice_seq, invoice_series into v_seq, v_series
    from orders where id = p_order_id
    for update;

  if not found then
    return null;
  end if;
  if v_seq is not null then
    return v_seq;  -- already issued; never issue a second one
  end if;

  v_seq := case
    when v_series = 'GVINV' then nextval('gift_voucher_invoice_seq')
    else nextval('invoice_seq')
  end;

  update orders set invoice_seq = v_seq, updated_at = now() where id = p_order_id;
  return v_seq;
end;
$$;

/*
 * Give an invoice number back, but only if it was the last one issued.
 *
 * Deleting an order that was confirmed by mistake should leave the run
 * unbroken, and rolling the sequence back does that cleanly when nothing has
 * been issued since.
 *
 * It refuses when a later invoice exists, and that refusal is the important
 * part: reassigning a number that has already been superseded would put two
 * different sales under one tax invoice number. A gap is a thing you can
 * explain to an auditor. A duplicate is not.
 */
create or replace function orders_reclaim_invoice(p_order_id text)
returns boolean
language plpgsql
as $$
declare
  v_seq    bigint;
  v_series text;
  v_max    bigint;
begin
  select invoice_seq, invoice_series into v_seq, v_series
    from orders where id = p_order_id;

  if v_seq is null then
    return false;  -- never issued one; nothing to give back
  end if;

  select max(invoice_seq) into v_max
    from orders
   where invoice_series is not distinct from v_series
     and id <> p_order_id;

  if v_max is not null and v_max > v_seq then
    return false;  -- a later invoice exists; this number stays spent
  end if;

  perform setval(
    case when v_series = 'GVINV' then 'gift_voucher_invoice_seq' else 'invoice_seq' end,
    greatest(v_seq - 1, 1),
    v_seq - 1 >= 1
  );
  return true;
end;
$$;

-- Order numbers reuse the gaps that deletions leave.
--
-- ATM-20260820-0003 is a reference a customer reads out on the phone, not a
-- tax document, so a deleted one is free to be given to the next order. What
-- must never happen is two live orders sharing one, which the unique index
-- below makes impossible regardless of what the application believes.
create unique index if not exists orders_order_number_idx on orders (order_number);

/*
 * The lowest unused order number for a given day.
 *
 * Counting today's rows (the old approach) breaks the moment anything is
 * deleted: with 3 orders and the second removed, the count is 2 and the next
 * order is handed -0003, which already exists. This looks for the first
 * actually-free slot instead, so deletions are reused and collisions are not
 * merely unlikely but impossible.
 *
 * generate_series is bounded at today's count plus one, which is always
 * enough: n existing orders can occupy at most n slots, so a free one exists
 * at or below n+1.
 */
create or replace function next_order_number(p_prefix text, p_date text)
returns text
language sql
as $$
  select p_prefix || '-' || p_date || '-' || lpad(candidate::text, 4, '0')
    from generate_series(
           1,
           (select count(*) + 1 from orders where order_number like '%' || p_date || '%')::int
         ) as candidate
   where not exists (
           select 1 from orders
            where order_number = p_prefix || '-' || p_date || '-' || lpad(candidate::text, 4, '0')
         )
   order by candidate
   limit 1;
$$;

-- Guest orders get a reference of their own.
--
-- A guest types whatever name they like into the shipping form, and the
-- dashboard showed that name with nothing to distinguish it from an account.
-- One customer typing "Naufal" made an order look like it came from the
-- owner's account. The reference is assigned by the shop, not the customer,
-- so it cannot be spoofed by typing.
--
-- It is also what a guest quotes to ask about their order, which is why it is
-- short enough to read down a phone line.
create sequence if not exists guest_ref_seq start with 1;

alter table orders add column if not exists guest_ref text;

create unique index if not exists orders_guest_ref_idx
  on orders (guest_ref) where guest_ref is not null;

/*
 * Assign a guest reference on insert, to guest orders only.
 *
 * A trigger rather than application code because "has no account" is a
 * property of the row, and checkout is not the only thing that can create
 * one. Signed-in orders are left alone: they already have an account to be
 * identified by.
 */
create or replace function orders_assign_guest_ref() returns trigger
language plpgsql
as $$
begin
  if new.user_id is null and new.guest_ref is null then
    new.guest_ref := 'Guest-ATO-' || lpad(nextval('guest_ref_seq')::text, 3, '0');
  end if;
  return new;
end;
$$;

drop trigger if exists orders_assign_guest_ref_trg on orders;
create trigger orders_assign_guest_ref_trg
  before insert on orders
  for each row execute function orders_assign_guest_ref();
