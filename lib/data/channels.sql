-- Which platform a hand-taken sale came from.
--
-- orders.source started as 'web' or 'manual', which answered "was this the
-- website" and nothing more. The question actually worth asking is which
-- channel the sale came through: Instagram and Facebook take different effort
-- and different money, and "manual" lumps them with a phone call and someone
-- walking in.
--
-- Same column rather than a second one, because this is the same fact at a
-- finer grain. 'manual' stays valid so any order already entered keeps its
-- meaning instead of failing the new constraint.
do $$
begin
  alter table orders drop constraint if exists orders_source_known;
exception
  when undefined_object then null;
end;
$$;

alter table orders
  add constraint orders_source_known
  check (source in (
    'web',        -- placed through the site by the customer
    'instagram',
    'facebook',
    'whatsapp',
    'viber',
    'phone',      -- rang up
    'walk-in',    -- asked in person
    'other',
    'manual'      -- entered by hand before channels were recorded
  ));
