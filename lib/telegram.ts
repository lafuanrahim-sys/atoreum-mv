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
 *   3. Open https://api.telegram.org/bot<TOKEN>/getUpdates and read
 *      result[0].message.chat.id — that is your chat id. For a group, add the
 *      bot to the group, post a message there, and use the group's negative id.
 *   4. Put both in .env.local and in Vercel's environment variables:
 *        TELEGRAM_BOT_TOKEN=...
 *        TELEGRAM_ORDER_CHAT_ID=...
 *
 * With either variable unset this is a no-op that logs once — the store must
 * keep taking orders whether or not notifications are configured.
 */

const API = "https://api.telegram.org";

let warned = false;

function config(): { token: string; chatId: string } | null {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  const chatId = process.env.TELEGRAM_ORDER_CHAT_ID?.trim();
  if (!token || !chatId) {
    if (!warned) {
      warned = true;
      console.warn(
        "[telegram] TELEGRAM_BOT_TOKEN / TELEGRAM_ORDER_CHAT_ID not set — order notifications are off."
      );
    }
    return null;
  }
  return { token, chatId };
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

/**
 * Fire-and-forget by design. Callers are on the checkout path, and a Telegram
 * outage, a revoked token or a network blip must never cost the store an
 * order. Failures are logged and swallowed; the boolean is for tests and for
 * the settings page's "send a test message" button.
 */
export async function sendTelegramMessage(html: string): Promise<boolean> {
  const cfg = config();
  if (!cfg) return false;

  try {
    // 8s ceiling: a serverless function should not sit waiting on a third
    // party after the work it was invoked for is already done.
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(`${API}/bot${cfg.token}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        chat_id: cfg.chatId,
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
      console.error(`[telegram] sendMessage failed: ${res.status} ${body.slice(0, 200)}`);
      return false;
    }
    return true;
  } catch (err) {
    console.error("[telegram] sendMessage threw:", err instanceof Error ? err.message : err);
    return false;
  }
}

export function telegramConfigured(): boolean {
  return Boolean(process.env.TELEGRAM_BOT_TOKEN?.trim() && process.env.TELEGRAM_ORDER_CHAT_ID?.trim());
}
