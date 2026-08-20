/**
 * Points Telegram at the shop's webhook, so replies in the staff group reach
 * the customer who asked.
 *
 * One-time, and idempotent: calling setWebhook again just overwrites the
 * previous registration. Worth re-running if the domain changes or the secret
 * is rotated, because Telegram holds both and neither updates on its own.
 *
 *   npx vercel env pull .env.production.local --environment=production
 *   npx tsx -r dotenv/config scripts/set-telegram-webhook.ts dotenv_config_path=.env.production.local
 *
 * Then delete .env.production.local; it holds every production secret.
 *
 * Pass --status to see what Telegram currently thinks, without changing it.
 */

const SITE = process.env.SITE_URL?.replace(/\/$/, "") ?? "https://atoreum.mv";

async function call(token: string, method: string, body?: unknown) {
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body ?? {}),
  });
  const json = (await res.json()) as { ok: boolean; result?: unknown; description?: string };
  if (!json.ok) {
    // Telegram puts the token in the URL path, so a bad token is a 404 on the
    // path and comes back as the bare word "Not Found". Said plainly it sounds
    // like the endpoint is missing, which sends you looking in the wrong place
    // entirely -- so name the actual cause here.
    if (res.status === 404) {
      throw new Error(
        `${method} failed: Telegram returned 404, which means it does not recognise this bot token.\n` +
          `  The token is wrong, revoked, or has stray quotes/whitespace around it.\n` +
          `  Check TELEGRAM_BOT_TOKEN in the environment you loaded.`
      );
    }
    throw new Error(`${method} failed: ${json.description ?? res.status}`);
  }
  return json.result;
}

async function main() {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET?.trim();

  if (!token) throw new Error("TELEGRAM_BOT_TOKEN is not set.");
  if (!secret) {
    // Registering without one would leave the endpoint unable to tell Telegram
    // from anyone else, and it refuses every update in that state anyway.
    throw new Error("TELEGRAM_WEBHOOK_SECRET is not set. Set it in Vercel first, or replies cannot be trusted.");
  }

  // Confirm the token before anything else. Every later call fails the same
  // opaque way on a bad token, and this one names the bot it belongs to, which
  // is also how you catch pointing at the wrong bot entirely.
  const me = (await call(token, "getMe")) as { username?: string; first_name?: string };
  console.log(`Bot: @${me.username ?? "?"} (${me.first_name ?? "?"})`);

  if (process.argv.includes("--status")) {
    console.log(JSON.stringify(await call(token, "getWebhookInfo"), null, 2));
    return;
  }

  const url = `${SITE}/api/telegram/webhook`;

  // Telegram only delivers to https, and refuses localhost outright. Catching
  // it here gives a straight answer instead of one of its terser ones.
  if (!url.startsWith("https://")) {
    throw new Error(`Telegram only delivers to https. SITE_URL resolved to "${SITE}".`);
  }
  console.log(`Registering ${url} ...`);

  await call(token, "setWebhook", {
    url,
    secret_token: secret,
    // Only messages. The bot has no use for edits, polls, or membership
    // changes, and every update type accepted is another shape the endpoint
    // has to be correct about.
    allowed_updates: ["message"],
    // Anything queued from before this registration is stale by definition.
    drop_pending_updates: true,
  });

  const info = (await call(token, "getWebhookInfo")) as {
    url?: string;
    has_custom_certificate?: boolean;
    pending_update_count?: number;
    last_error_message?: string;
  };

  console.log("  done.");
  console.log(`  url:      ${info.url}`);
  console.log(`  pending:  ${info.pending_update_count ?? 0}`);
  if (info.last_error_message) {
    console.log(`  NOTE: Telegram's last delivery attempt failed: ${info.last_error_message}`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  });
