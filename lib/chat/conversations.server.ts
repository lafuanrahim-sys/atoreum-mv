import { randomBytes } from "node:crypto";
import { pool } from "@/lib/db";

/**
 * Conversation persistence, so a human can answer.
 *
 * The customer's claim on a conversation is a random token in an httpOnly
 * cookie, and nothing else. Not their IP, not a guessable id, and not their
 * account -- guests need to read their own replies too, and a signed-in
 * customer may hold separate conversations in two browsers.
 *
 * That makes the token a bearer credential, so it is generated here from
 * crypto randomness, only ever looked up by exact match, and never derived
 * from anything about the customer.
 */

export const CHAT_COOKIE = "atoreum_chat";

export type ChatRole = "customer" | "assistant" | "staff";

/** Who is answering right now. */
export type ChatMode = "ai" | "human";

/**
 * What the customer is shown in place of a staff member's real name.
 *
 * Deliberately one label for everyone. Which of two people happened to pick
 * up the message is the shop's business, not the customer's, and a name that
 * changes between replies reads as being passed around.
 */
export const STAFF_DISPLAY_NAME = "Customer Support";

export type StoredMessage = {
  id: string;
  role: ChatRole;
  content: string;
  staffName: string;
  createdAt: string;
};

export function newVisitorToken(): string {
  return randomBytes(32).toString("base64url");
}

/**
 * Find the conversation this token owns, or start one.
 *
 * Upsert rather than select-then-insert: two requests from the same browser
 * can arrive together (a message and a poll), and the unique index on
 * visitor_token is what decides, not the application.
 */
/**
 * How long an abandoned conversation is kept.
 *
 * The customer's own copy dies with their browser, so this is not history in
 * any sense they can see; it is the window in which a staff reply still has
 * somewhere to land. Three days is generous for a shop that answers the same
 * evening, and short enough that the tables do not become a transcript
 * archive nobody asked for.
 */
const RETENTION_DAYS = 3;

// Pruning is opportunistic rather than scheduled: no cron to forget to
// deploy, and no delete on the hot path more than once an hour per process.
let lastPrune = 0;

async function pruneOldConversations(): Promise<void> {
  const now = Date.now();
  if (now - lastPrune < 3_600_000) return;
  lastPrune = now;
  try {
    // chat_messages is ON DELETE CASCADE, so this takes the messages with it.
    const { rowCount } = await pool().query(
      `delete from chat_conversations
        where updated_at < now() - ($1 || ' days')::interval`,
      [RETENTION_DAYS]
    );
    if (rowCount) console.log(`[chat] pruned ${rowCount} conversation(s) past retention.`);
  } catch (err) {
    console.error("[chat] could not prune old conversations:", err);
  }
}

export async function getOrCreateConversation(params: {
  visitorToken: string;
  userId: string | null;
}): Promise<string> {
  void pruneOldConversations();

  const { rows } = await pool().query<{ id: string }>(
    `insert into chat_conversations (visitor_token, user_id)
     values ($1, $2)
     on conflict (visitor_token) do update
        set updated_at = now(),
            -- Attach the account the first time a signed-in customer uses an
            -- existing conversation, but never detach it when they sign out.
            user_id = coalesce(excluded.user_id, chat_conversations.user_id)
     returning id`,
    [params.visitorToken, params.userId]
  );
  return rows[0].id;
}

export async function appendMessage(params: {
  conversationId: string;
  role: ChatRole;
  content: string;
  staffName?: string;
}): Promise<void> {
  await pool().query(
    `insert into chat_messages (conversation_id, role, content, staff_name)
     values ($1, $2, $3, $4)`,
    [params.conversationId, params.role, params.content, params.staffName ?? ""]
  );
  await pool().query("update chat_conversations set updated_at = now() where id = $1", [
    params.conversationId,
  ]);
}

/**
 * Staff messages the browser has not shown yet.
 *
 * Scoped by visitor token, not by conversation id: the browser polls with the
 * credential it holds, and never names a conversation. Passing an id would
 * make "whose conversation is this" a question the caller gets to answer.
 *
 * `since` is a timestamp the client last saw, so a customer with two tabs open
 * gets the reply in both rather than whichever polled first.
 */
export async function getStaffMessagesSince(params: {
  visitorToken: string;
  since: string | null;
}): Promise<StoredMessage[]> {
  const { rows } = await pool().query<{
    id: string;
    role: ChatRole;
    content: string;
    staff_name: string;
    created_at: Date;
  }>(
    `select m.id, m.role, m.content, m.staff_name, m.created_at
       from chat_messages m
       join chat_conversations c on c.id = m.conversation_id
      where c.visitor_token = $1
        and m.role = 'staff'
        and ($2::timestamptz is null or m.created_at > $2::timestamptz)
      order by m.created_at`,
    [params.visitorToken, params.since]
  );
  return rows.map((r) => ({
    id: r.id,
    role: r.role,
    content: r.content,
    staffName: r.staff_name,
    createdAt: r.created_at.toISOString(),
  }));
}

/**
 * The conversation's current state, by the customer's own token.
 *
 * Returned together because every caller that cares about the mode also needs
 * the anchor: there is nothing useful to do with "this is in human mode"
 * without knowing where to send the message.
 */
export async function getConversationState(visitorToken: string): Promise<{
  id: string;
  mode: ChatMode;
  telegramChatId: string | null;
  telegramMessageId: number | null;
} | null> {
  const { rows } = await pool().query<{
    id: string;
    mode: ChatMode;
    telegram_chat_id: string | null;
    telegram_message_id: string | null;
  }>(
    "select id, mode, telegram_chat_id, telegram_message_id from chat_conversations where visitor_token = $1",
    [visitorToken]
  );
  const r = rows[0];
  if (!r) return null;
  return {
    id: r.id,
    mode: r.mode,
    telegramChatId: r.telegram_chat_id,
    // bigint arrives as a string from pg; Telegram message ids are well within
    // Number's safe range, so this is a narrowing rather than a gamble.
    telegramMessageId: r.telegram_message_id === null ? null : Number(r.telegram_message_id),
  };
}

/**
 * Switch who is answering. Returns the mode actually in force.
 *
 * Not always what was asked: handing to a human needs a Telegram anchor for
 * the human to reply to, and the database refuses to pretend otherwise.
 */
export async function setConversationMode(conversationId: string, mode: ChatMode): Promise<ChatMode> {
  const { rows } = await pool().query<{ chat_set_mode: ChatMode }>(
    "select chat_set_mode($1, $2)",
    [conversationId, mode]
  );
  return rows[0]?.chat_set_mode ?? "ai";
}

/** Point a Telegram message at this conversation. False if already claimed. */
export async function linkTelegramMessage(params: {
  conversationId: string;
  chatId: string;
  messageId: number;
}): Promise<boolean> {
  const { rows } = await pool().query<{ chat_link_telegram: boolean }>(
    "select chat_link_telegram($1, $2, $3)",
    [params.conversationId, params.chatId, params.messageId]
  );
  const linked = rows[0]?.chat_link_telegram ?? false;
  // The column still records the ORIGINAL alert, which is what staff replies
  // are threaded under and what chat_set_mode checks for. The anchors table is
  // what lookups use.
  if (linked) await addTelegramAnchor(params);
  return linked;
}

/**
 * Which conversation a Telegram reply belongs to.
 *
 * Both halves of the key are required. A message id alone is a small integer
 * that repeats across chats, so matching on it by itself would let a reply in
 * one chat land in a conversation escalated from another.
 */
export async function findConversationByTelegramMessage(params: {
  chatId: string;
  messageId: number;
}): Promise<{ id: string; contact: string } | null> {
  const { rows } = await pool().query<{ id: string; contact: string }>(
    `select c.id, c.contact
       from chat_telegram_anchors a
       join chat_conversations c on c.id = a.conversation_id
      where a.chat_id = $1 and a.message_id = $2`,
    [params.chatId, params.messageId]
  );
  return rows[0] ?? null;
}

/**
 * Register another of the bot's own messages as a reply target.
 *
 * Called for every message the bot puts into a thread -- confirmations,
 * forwarded customer messages -- because staff reply to whichever is newest,
 * not to the original alert several messages up.
 *
 * Never throws: failing to register one message costs a reply target, and is
 * not worth failing the delivery that just succeeded.
 */
export async function addTelegramAnchor(params: {
  conversationId: string;
  chatId: string;
  messageId: number;
}): Promise<void> {
  try {
    await pool().query("select chat_anchor_add($1, $2, $3)", [
      params.conversationId,
      params.chatId,
      params.messageId,
    ]);
  } catch (err) {
    console.error("[chat] could not register a Telegram anchor:", err);
  }
}

export async function setConversationContact(conversationId: string, contact: string): Promise<void> {
  await pool().query("update chat_conversations set contact = $2, updated_at = now() where id = $1", [
    conversationId,
    contact.slice(0, 200),
  ]);
}

/** The last N turns of a conversation, for the escalation message. */
export async function getRecentMessages(
  conversationId: string,
  limit = 6
): Promise<StoredMessage[]> {
  const { rows } = await pool().query<{
    id: string;
    role: ChatRole;
    content: string;
    staff_name: string;
    created_at: Date;
  }>(
    `select id, role, content, staff_name, created_at
       from chat_messages
      where conversation_id = $1
      order by created_at desc
      limit $2`,
    [conversationId, limit]
  );
  return rows
    .reverse()
    .map((r) => ({
      id: r.id,
      role: r.role,
      content: r.content,
      staffName: r.staff_name,
      createdAt: r.created_at.toISOString(),
    }));
}
