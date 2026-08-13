import fs from "node:fs";

/**
 * Finds every chat that has talked to the bot, adds them to
 * TELEGRAM_ORDER_CHAT_ID, and says hello in each.
 *
 * This exists because a Telegram bot cannot open a conversation: a chat id
 * only becomes knowable once a human messages the bot, or adds it to a group.
 * Rather than asking the owner to visit a getUpdates URL and copy numbers out
 * of raw JSON, this polls for them and writes the values where they belong.
 *
 *   npx tsx --env-file=.env.local scripts/telegram-link.ts
 *
 * Adds rather than replaces. The list is how more than one person gets told
 * about an order, so linking a second recipient must not silently unlink the
 * first — every previous version of this script did exactly that, and the
 * failure was invisible until an order arrived and only one phone buzzed.
 *
 * For a group: add the bot to the group and run this. Being added fires a
 * my_chat_member update on its own, so nobody has to remember to post a
 * message first, and it arrives whether or not the bot has privacy mode on.
 */
const TOKEN = process.env.TELEGRAM_BOT_TOKEN?.trim();
const API = `https://api.telegram.org/bot${TOKEN}`;
const DEADLINE_MS = 10 * 60 * 1000;

type Chat = { id: number; type: string; title?: string; first_name?: string; username?: string };

function describe(chat: Chat): string {
  const who = chat.title ?? [chat.first_name, chat.username && `@${chat.username}`].filter(Boolean).join(" ");
  return `${chat.id} (${chat.type})${who ? ` ${who}` : ""}`;
}

/** Every distinct chat in the update queue, not just the first one. Both
 * recipients may already have written to the bot by the time this runs. */
async function findChats(): Promise<Chat[]> {
  const res = await fetch(`${API}/getUpdates`).then((r) => r.json());
  if (!res.ok) throw new Error(JSON.stringify(res).slice(0, 200));
  const seen = new Map<number, Chat>();
  for (const u of res.result) {
    const chat = (u.message ?? u.channel_post ?? u.my_chat_member ?? u.edited_message)?.chat;
    if (chat && !seen.has(chat.id)) seen.set(chat.id, chat as Chat);
  }
  return [...seen.values()];
}

function currentIds(env: string): string[] {
  const line = env.match(/^TELEGRAM_ORDER_CHAT_ID=(.*)$/m);
  return (line?.[1] ?? "").split(/[,\s]+/).map((s) => s.trim()).filter(Boolean);
}

/** Returns the ids that were not already recorded. */
function writeEnv(chatIds: number[]): string[] {
  const env = fs.readFileSync(".env.local", "utf8");
  const existing = currentIds(env);
  const added = chatIds.map(String).filter((id) => !existing.includes(id));
  if (added.length === 0) return [];

  const line = `TELEGRAM_ORDER_CHAT_ID=${[...existing, ...added].join(",")}`;
  fs.writeFileSync(
    ".env.local",
    /^TELEGRAM_ORDER_CHAT_ID=.*$/m.test(env)
      ? env.replace(/^TELEGRAM_ORDER_CHAT_ID=.*$/m, line)
      : `${env.replace(/\s*$/, "\n")}${line}\n`
  );
  return added;
}

async function main() {
  if (!TOKEN) throw new Error("TELEGRAM_BOT_TOKEN is not set.");
  const started = Date.now();
  for (;;) {
    const chats = await findChats().catch((e) => {
      console.error("poll failed:", (e as Error).message);
      return [] as Chat[];
    });

    if (chats.length > 0) {
      console.log(`found ${chats.length} chat(s):`);
      for (const c of chats) console.log(`  ${describe(c)}`);

      const added = writeEnv(chats.map((c) => c.id));
      if (added.length === 0) {
        console.log("\nall of them were already linked — nothing to write.");
        return;
      }
      console.log(`\nadded to TELEGRAM_ORDER_CHAT_ID: ${added.join(", ")}`);

      for (const chat of chats.filter((c) => added.includes(String(c.id)))) {
        const sent = await fetch(`${API}/sendMessage`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            chat_id: chat.id,
            text: "✅ <b>Atoreum MV connected.</b>\nYou'll get a message here the moment an order is placed.",
            parse_mode: "HTML",
          }),
        }).then((r) => r.json());
        console.log(sent.ok ? `confirmation sent to ${chat.id}` : `confirmation to ${chat.id} failed: ${JSON.stringify(sent).slice(0, 160)}`);
      }

      console.log("\nRemember to set the same value in Vercel's environment variables.");
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
