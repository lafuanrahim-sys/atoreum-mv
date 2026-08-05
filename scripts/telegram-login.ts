import readline from "node:readline/promises";
import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions";

/**
 * One-time, interactive, run locally:
 *   npx tsx --env-file=.env.local scripts/telegram-login.ts
 *
 * Needs TELEGRAM_API_ID / TELEGRAM_API_HASH in .env.local first, from
 * https://my.telegram.org -> API development tools. Prompts for your phone
 * number and the login code Telegram texts you (and your 2FA password if
 * you have one), then prints a session string.
 *
 * That string is a saved login for your own Telegram account -- put it in
 * TELEGRAM_SESSION (.env.local and the Vercel production env), never
 * commit it, treat it like a password.
 */
const apiId = Number(process.env.TELEGRAM_API_ID);
const apiHash = process.env.TELEGRAM_API_HASH;

if (!apiId || !apiHash) {
  throw new Error("Set TELEGRAM_API_ID and TELEGRAM_API_HASH in .env.local first (from my.telegram.org).");
}

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

async function main() {
  const client = new TelegramClient(new StringSession(""), apiId, apiHash as string, {
    connectionRetries: 5,
  });

  await client.start({
    phoneNumber: () => rl.question("Phone number (with country code, e.g. +960...): "),
    phoneCode: () => rl.question("Code Telegram just texted you: "),
    password: () => rl.question("2FA password (press enter if you don't have one): "),
    onError: (err) => console.error(err),
  });

  console.log("\nLogged in. Save this as TELEGRAM_SESSION (.env.local and Vercel) -- never commit it:\n");
  console.log(client.session.save());

  await client.disconnect();
  rl.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
