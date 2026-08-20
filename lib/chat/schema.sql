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


-- ---------------------------------------------------------------------------
-- Conversations, and replying to them from Telegram.
-- ---------------------------------------------------------------------------
--
-- Chat was ephemeral before this: it lived in the customer's browser tab and
-- was gone on refresh. That is fine for a bot answering from a catalogue, and
-- useless the moment a human wants to answer, because there is nothing to
-- answer. These two tables are what a reply attaches to.
--
-- The Telegram half is a message id, nothing cleverer. Staff reply to the
-- alert in the group the way they would reply to anyone, Telegram tells the
-- webhook which message was replied to, and that id names the conversation.
-- Nobody has to learn a command or paste a reference.

create table if not exists chat_conversations (
  id uuid primary key default gen_random_uuid(),

  -- The bearer token in the customer's cookie. This IS the credential that
  -- lets a browser read this conversation back, so it is generated server
  -- side and never derived from anything guessable.
  visitor_token text not null unique,

  -- Set when the customer is signed in. Not a substitute for visitor_token:
  -- one person can hold two conversations from two browsers.
  user_id text references users(id) on delete set null,

  -- Whatever contact the customer gave when escalating.
  contact text not null default '',

  -- The escalation message in the staff group. A reply to it lands here.
  -- Null until the conversation is escalated; most never are.
  telegram_chat_id    text,
  telegram_message_id bigint,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- One conversation per Telegram message, so a reply can never be ambiguous.
  constraint chat_conversations_one_per_telegram_message
    unique (telegram_chat_id, telegram_message_id)
);

create index if not exists chat_conversations_updated_idx
  on chat_conversations (updated_at desc);

create table if not exists chat_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references chat_conversations(id) on delete cascade,

  -- 'customer' typed it, 'assistant' generated it, 'staff' is a human at the
  -- shop replying from Telegram. The customer sees all three; only 'staff' is
  -- attributed to a person by name.
  role text not null check (role in ('customer', 'assistant', 'staff')),
  content text not null,

  -- Who at the shop sent it, for staff messages. Shown to the customer,
  -- because "Maahil" reads better than "Support".
  staff_name text not null default '',

  created_at timestamptz not null default now()
);

create index if not exists chat_messages_conversation_idx
  on chat_messages (conversation_id, created_at);

/*
 * Attach a Telegram message to a conversation, so replies to it come back here.
 *
 * Returns false when that message id is already claimed. Two escalations
 * cannot share one message, and without the guard a race could point a staff
 * reply at the wrong customer, which is a privacy failure rather than a bug.
 */
create or replace function chat_link_telegram(
  p_conversation uuid,
  p_chat_id text,
  p_message_id bigint
) returns boolean
language plpgsql
as $$
begin
  update chat_conversations
     set telegram_chat_id = p_chat_id,
         telegram_message_id = p_message_id,
         updated_at = now()
   where id = p_conversation;
  return found;
exception
  when unique_violation then
    return false;
end;
$$;


-- ---------------------------------------------------------------------------
-- Who is answering: the assistant, or a person.
-- ---------------------------------------------------------------------------
--
-- Once a customer has been told a human will get back to them, the assistant
-- answering the next message is actively harmful: it talks over the person
-- who was promised, and it invites the customer to keep asking the bot the
-- thing the bot already could not settle.
--
-- So a conversation has exactly one voice at a time. Escalating hands it to
-- staff; staff hand it back with a command when the customer turns out to want
-- something ordinary, like a product recommendation, which the assistant does
-- better and instantly.

alter table chat_conversations
  add column if not exists mode text not null default 'ai';

do $$
begin
  alter table chat_conversations
    add constraint chat_conversations_mode_known check (mode in ('ai', 'human'));
exception
  when duplicate_object then null;
end;
$$;

/*
 * Hand a conversation to staff, or back to the assistant.
 *
 * Returns the mode actually in force afterwards, which is not always the one
 * asked for: handing to a human requires somewhere for the human to reply, and
 * a conversation with no Telegram anchor has none. Silently switching it would
 * leave the customer waiting on a person who was never told.
 */
create or replace function chat_set_mode(p_conversation uuid, p_mode text)
returns text
language plpgsql
as $$
declare
  v_anchor bigint;
  v_mode   text;
begin
  select telegram_message_id into v_anchor
    from chat_conversations where id = p_conversation;

  v_mode := case
    when p_mode = 'human' and v_anchor is null then 'ai'
    else p_mode
  end;

  update chat_conversations
     set mode = v_mode, updated_at = now()
   where id = p_conversation;

  return v_mode;
end;
$$;
