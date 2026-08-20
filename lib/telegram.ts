/**
 * Telegram notifications for the store owner.
 *
 * Uses the Bot API over plain HTTPS, NOT the GramJS user-account client this
 * project already carries for reading the Mystic Exchange rate. That client
 * logs in as a person: it needs a session string, that session can be
 * invalidated by Telegram or by signing out elsewhere, and it keeps a
 * long-lived connection — none of which survives a serverless function that
 * is created and destroyed per request. A bot token is a static credential
 * and every send is one stateless POST, which is exactly what this needs.
 *
 * Setup (once, takes about two minutes):
 *   1. In Telegram, message @BotFather and send /newbot. Follow the prompts.
 *      It replies with a token like 123456789:AAF-xxxxxxxxxxxxxxxxxxxxxxxx.
 *   2. Send your new bot any message (it cannot message you first).
 *   3. Run `npx tsx --env-file=.env.local scripts/telegram-link.ts`, which
 *      reads the chat id out of that message and records it. Or do it by hand:
 *      open https://api.telegram.org/bot<TOKEN>/getUpdates and read
 *      result[0].message.chat.id. For a group, add the bot to the group and
 *      use the group's negative id.
 *   4. Put both in .env.local and in Vercel's environment variables:
 *        TELEGRAM_BOT_TOKEN=...
 *        TELEGRAM_ORDER_CHAT_ID=...
 *
 * TELEGRAM_ORDER_CHAT_ID takes a comma-separated list, so more than one person
 * can be notified: either several private chats, or one group id, or both.
 * A group is usually the better shape — everyone sees the same thread and can
 * talk about an order in the place it arrived — but two people who want it in
 * their own DMs is equally valid, and this doesn't force the choice.
 *
 * With either variable unset this is a no-op that logs once — the store must
 * keep taking orders whether or not notifications are configured.
 */

const API = "https://api.telegram.org";

let warned = false;

/** Split on commas or whitespace, drop blanks — tolerant of "111, -222" and
 * of a trailing comma left behind by editing the list. */
export function parseChatIds(raw: string | undefined): string[] {
  return (raw ?? "")
    .split(/[,\s]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function config(): { token: string; chatIds: string[] } | null {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  const chatIds = parseChatIds(process.env.TELEGRAM_ORDER_CHAT_ID);
  if (!token || chatIds.length === 0) {
    if (!warned) {
      warned = true;
      console.warn(
        "[telegram] TELEGRAM_BOT_TOKEN / TELEGRAM_ORDER_CHAT_ID not set — order notifications are off."
      );
    }
    return null;
  }
  return { token, chatIds };
}

/**
 * Telegram's HTML parse mode accepts a small tag set and rejects the whole
 * message on a stray `<`, so anything interpolated from an order — a customer
 * name, a product name — is escaped first. A malformed message is not a
 * cosmetic problem here: the API returns 400 and the notification is simply
 * never delivered.
 */
export function escapeTelegramHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

async function sendToChat(token: string, chatId: string, html: string): Promise<boolean> {
  try {
    // 8s ceiling: a serverless function should not sit waiting on a third
    // party after the work it was invoked for is already done.
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(`${API}/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: html,
        parse_mode: "HTML",
        disable_web_page_preview: true,
      }),
      signal: controller.signal,
    }).finally(() => clearTimeout(timer));

    if (!res.ok) {
      // The body carries Telegram's own description ("chat not found",
      // "bot was blocked by the user"), which is the difference between a
      // fixable misconfiguration and a mystery.
      const body = await res.text().catch(() => "");
      console.error(`[telegram] sendMessage to ${chatId} failed: ${res.status} ${body.slice(0, 200)}`);
      return false;
    }
    return true;
  } catch (err) {
    console.error(`[telegram] sendMessage to ${chatId} threw:`, err instanceof Error ? err.message : err);
    return false;
  }
}

/**
 * Fire-and-forget by design. Callers are on the checkout path, and a Telegram
 * outage, a revoked token or a network blip must never cost the store an
 * order. Failures are logged and swallowed; the boolean is for tests and for
 * the settings page's "send a test message" button.
 *
 * Every configured chat is sent to independently and in parallel. One person
 * blocking the bot, or leaving the group, must not stop the other from being
 * told an order came in — so the recipients cannot share a failure, and the
 * returned boolean means "at least one person was reached", which is the
 * question that actually matters.
 */
export async function sendTelegramMessage(html: string): Promise<boolean> {
  const { delivered } = await sendTelegramMessageDetailed(html);
  return delivered.length > 0;
}

/**
 * The same send, reporting which chats took it and which didn't.
 *
 * The order path doesn't care — it has no one to tell and nothing to do about
 * a failure. An admin pressing "test notifications" does care, and the
 * difference between "one of your two recipients is unreachable" and a bare
 * "sent" is the entire value of pressing the button.
 */
export async function sendTelegramMessageDetailed(
  html: string
): Promise<{ delivered: string[]; failed: string[]; configured: boolean }> {
  const cfg = config();
  if (!cfg) return { delivered: [], failed: [], configured: false };

  const results = await Promise.all(
    cfg.chatIds.map(async (id) => ({ id, ok: await sendToChat(cfg.token, id, html) }))
  );
  return {
    delivered: results.filter((r) => r.ok).map((r) => r.id),
    failed: results.filter((r) => !r.ok).map((r) => r.id),
    configured: true,
  };
}

export function telegramConfigured(): boolean {
  return Boolean(process.env.TELEGRAM_BOT_TOKEN?.trim() && parseChatIds(process.env.TELEGRAM_ORDER_CHAT_ID).length > 0);
}

/**
 * Send, and report where the message landed.
 *
 * The ordinary senders above return a boolean because their callers have
 * nothing to do with the answer. The chat assistant does: staff reply to the
 * escalation message in the group, and Telegram identifies which message was
 * replied to by (chat id, message id). Without those two values there is no
 * way to route a reply back to the customer who asked.
 *
 * Only the first configured chat is reported. Every chat gets the message, but
 * a conversation can only be anchored to one of them, and anchoring to the
 * first is at least predictable.
 */
export async function sendTelegramMessageAnchored(
  html: string
): Promise<{ chatId: string; messageId: number } | null> {
  const cfg = config();
  if (!cfg) return null;

  let anchor: { chatId: string; messageId: number } | null = null;

  await Promise.all(
    cfg.chatIds.map(async (chatId, index) => {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 8000);
        const res = await fetch(`${API}/bot${cfg.token}/sendMessage`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            chat_id: chatId,
            text: html,
            parse_mode: "HTML",
            disable_web_page_preview: true,
          }),
          signal: controller.signal,
        }).finally(() => clearTimeout(timer));

        if (!res.ok) {
          const body = await res.text().catch(() => "");
          console.error(`[telegram] anchored send to ${chatId} failed: ${res.status} ${body.slice(0, 200)}`);
          return;
        }

        const data = (await res.json()) as { result?: { message_id?: number } };
        const messageId = data.result?.message_id;
        if (index === 0 && typeof messageId === "number") {
          anchor = { chatId, messageId };
        }
      } catch (err) {
        console.error(`[telegram] anchored send to ${chatId} threw:`, err instanceof Error ? err.message : err);
      }
    })
  );

  return anchor;
}

/** Reply to a specific message in a chat -- used to confirm a staff reply was delivered. */
export async function replyInTelegram(params: {
  chatId: string;
  replyToMessageId: number;
  html: string;
}): Promise<boolean> {
  const cfg = config();
  if (!cfg) return false;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(`${API}/bot${cfg.token}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        chat_id: params.chatId,
        text: params.html,
        parse_mode: "HTML",
        disable_web_page_preview: true,
        reply_to_message_id: params.replyToMessageId,
      }),
      signal: controller.signal,
    }).finally(() => clearTimeout(timer));
    return res.ok;
  } catch {
    return false;
  }
}
