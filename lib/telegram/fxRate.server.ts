import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions";

/**
 * Reads the latest USD buying rate posted in the Mystic Exchange Telegram
 * group (t.me/mysticexchange) -- the same manual source that was being
 * typed into fx_settings.latest_market_rate by hand. Each post lists
 * several currencies as separate lines, e.g.:
 *   Buying USD 💵 21.30🔥🔥
 *   Buying 🪙 USDT
 *   Buying 💶 EURO 23.80
 * \bUSD\b (not \bUSDT\b -- "T" sits right after "D" with no word boundary
 * between them) isolates the USD line; the first number on it is the rate.
 */
const GROUP = "mysticexchange";
const MESSAGE_SCAN_LIMIT = 30;

export type TelegramRateResult = {
  rate: number;
  postedAt: Date;
  raw: string;
};

function extractUsdBuyRate(text: string): number | null {
  const line = text.split("\n").find((l) => /\bUSD\b/i.test(l) && /\bbuy/i.test(l));
  if (!line) return null;
  const match = line.match(/(\d+(?:\.\d+)?)/);
  return match ? Number(match[1]) : null;
}

/** Scans recent messages newest-first and returns the first one with a parseable USD buying line. */
export async function fetchLatestUsdBuyRateFromTelegram(): Promise<TelegramRateResult | null> {
  const apiId = Number(process.env.TELEGRAM_API_ID);
  const apiHash = process.env.TELEGRAM_API_HASH;
  const session = process.env.TELEGRAM_SESSION;
  if (!apiId || !apiHash || !session) {
    throw new Error("TELEGRAM_API_ID, TELEGRAM_API_HASH, and TELEGRAM_SESSION must all be set.");
  }

  const client = new TelegramClient(new StringSession(session), apiId, apiHash, {
    connectionRetries: 3,
  });
  await client.connect();

  try {
    const messages = await client.getMessages(GROUP, { limit: MESSAGE_SCAN_LIMIT });
    for (const msg of messages) {
      const text = msg.message ?? "";
      const rate = extractUsdBuyRate(text);
      if (rate !== null) {
        return { rate, postedAt: new Date(msg.date * 1000), raw: text };
      }
    }
    return null;
  } finally {
    await client.disconnect();
  }
}
