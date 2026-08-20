-- Chat usage accounting.
--
-- The assistant's endpoint is public and unauthenticated, which means it is
-- the shop's Anthropic key wearing a URL. Nobody needs to steal the key to
-- spend it; they only need to POST to /api/chat in a loop.
--
-- lib/rateLimit.ts is the first line against that, but it is an in-memory Map:
-- per serverless instance, wiped on cold start, and keyed on an IP that costs
-- nothing to rotate. It shapes casual abuse and cannot bound spend.
--
-- This table is what bounds spend. It is shared by every instance, survives
-- restarts, and carries a global daily counter that no amount of IP rotation
-- can get around. When that counter is spent, the assistant stops answering
-- until tomorrow. A shop with a quiet assistant for an evening is a nuisance;
-- a shop with an unbounded API bill is a real problem.

create table if not exists chat_usage (
  day           date    not null,
  -- 'global', or 'u:<user id>', or 'ip:<address>'.
  bucket        text    not null,
  requests      integer not null default 0,
  input_tokens  bigint  not null default 0,
  output_tokens bigint  not null default 0,
  updated_at    timestamptz not null default now(),
  primary key (day, bucket),
  constraint chat_usage_counts_non_negative
    check (requests >= 0 and input_tokens >= 0 and output_tokens >= 0)
);

-- Yesterday's rows are only of interest for a day or two. Nothing prunes them
-- automatically; the table gains a handful of rows a day and is trivial to
-- clear by hand if it ever matters.
create index if not exists chat_usage_day_idx on chat_usage (day desc);

/*
 * Claim one request against a bucket's daily allowance.
 *
 * Returns true when the request may proceed, false when the cap is already
 * spent. The check and the increment are the same statement, so two instances
 * racing on the last unit of allowance cannot both win: the row is locked by
 * the ON CONFLICT update, and the loser sees the incremented count.
 *
 * A caller that is refused is NOT charged for the attempt -- the WHERE blocks
 * the update, so a client hammering a spent bucket does not push the counter
 * further and cannot extend its own lockout.
 */
create or replace function chat_usage_claim(p_bucket text, p_limit integer)
returns boolean
language plpgsql
as $$
declare
  v_requests integer;
begin
  -- A zero or negative allowance is a closed door, not an off-by-one: without
  -- this, the first insert of the day would still succeed with requests = 1.
  if p_limit is null or p_limit <= 0 then
    return false;
  end if;

  insert into chat_usage (day, bucket, requests)
  values (current_date, p_bucket, 1)
  on conflict (day, bucket) do update
     set requests   = chat_usage.requests + 1,
         updated_at = now()
   where chat_usage.requests < p_limit
  returning requests into v_requests;

  -- No row returned means the WHERE refused the update: already at the cap.
  return v_requests is not null;
end;
$$;

/*
 * Record what a completed request actually cost.
 *
 * Separate from the claim because the true token count is only known after the
 * model has answered. Claiming bounds the NUMBER of requests; this records
 * their SIZE, which is what makes the cap tunable against a real bill rather
 * than a guess.
 */
create or replace function chat_usage_record(
  p_bucket text,
  p_input  bigint,
  p_output bigint
) returns void
language sql
as $$
  insert into chat_usage (day, bucket, requests, input_tokens, output_tokens)
  values (current_date, p_bucket, 0, greatest(p_input, 0), greatest(p_output, 0))
  on conflict (day, bucket) do update
     set input_tokens  = chat_usage.input_tokens  + greatest(p_input, 0),
         output_tokens = chat_usage.output_tokens + greatest(p_output, 0),
         updated_at    = now();
$$;
