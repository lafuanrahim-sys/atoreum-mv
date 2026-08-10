import fs from "node:fs";

/**
 * Waits for the first message sent to the bot, records that chat as the
 * notification target, and sends a confirmation back to it.
 *
 * This exists because a Telegram bot cannot open a conversation: the chat id
 * only becomes knowable once a human messages the bot first. Rather than
 * asking the owner to visit a getUpdates URL and copy a number out of raw
 * JSON, this polls for them and writes the value where it belongs.
 *
 *   npx tsx --env-file=.env.local scripts/telegram-link.ts
 */
const TOKEN = process.env.TELEGRAM_BOT_TOKEN?.trim();
const API = `https://api.telegram.org/bot${TOKEN}`;
const DEADLINE_MS = 10 * 60 * 1000;

type Chat = { id: number; type: string; title?: string; first_name?: string; username?: string };

async function findChat(): Promise<Chat | null> {
  const res = await fetch(`${API}/getUpdates`).then((r) => r.json());
  if (!res.ok) throw new Error(JSON.stringify(res).slice(0, 200));
  for (const u of res.result) {
    const chat = (u.message ?? u.channel_post ?? u.my_chat_member)?.chat;
    if (chat) return chat as Chat;
  }
  return null;
}

function writeEnv(chatId: number) {
  const s = fs.readFileSync(".env.local", "utf8");
  const line = `TELEGRAM_ORDER_CHAT_ID=${chatId}`;
  fs.writeFileSync(
    ".env.local",
    /^TELEGRAM_ORDER_CHAT_ID=.*$/m.test(s) ? s.replace(/^TELEGRAM_ORDER_CHAT_ID=.*$/m, line) : `${s.replace(/\s*$/, "\n")}${line}\n`
  );
}

async function main() {
  if (!TOKEN) throw new Error("TELEGRAM_BOT_TOKEN is not set.");
  const started = Date.now();
  for (;;) {
    const chat = await findChat().catch((e) => {
      console.error("poll failed:", (e as Error).message);
      return null;
    });
    if (chat) {
      writeEnv(chat.id);
      const who = chat.title ?? [chat.first_name, chat.username && `@${chat.username}`].filter(Boolean).join(" ");
      console.log(`linked chat ${chat.id} (${chat.type}) ${who}`);
      const sent = await fetch(`${API}/sendMessage`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          chat_id: chat.id,
          text: "✅ <b>Atoreum MV connected.</b>\nYou'll get a message here the moment an order is placed.",
          parse_mode: "HTML",
        }),
      }).then((r) => r.json());
      console.log(sent.ok ? "confirmation sent" : `confirmation failed: ${JSON.stringify(sent).slice(0, 160)}`);
      return;
    }
    if (Date.now() - started > DEADLINE_MS) {
      console.log("timed out — the bot was never messaged.");
      process.exitCode = 1;
      return;
    }
    await new Promise((r) => setTimeout(r, 3000));
  }
}
main().catch((err) => {
  console.error(err.message ?? err);
  process.exitCode = 1;
});
