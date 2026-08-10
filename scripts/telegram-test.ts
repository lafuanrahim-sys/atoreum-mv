import { sendTelegramMessage, telegramConfigured } from "@/lib/telegram";
import { renderOrderTelegramMessage } from "@/lib/notify";
import type { Order } from "@/lib/types";
import { pool } from "@/lib/db";

/**
 * Sends one sample order notification, so the bot wiring can be proved before
 * a real customer depends on it:
 *   npx tsx --env-file=.env.local scripts/telegram-test.ts
 */
async function main() {
  if (!telegramConfigured()) {
    console.error(
      "TELEGRAM_BOT_TOKEN / TELEGRAM_ORDER_CHAT_ID are not set.\n" +
        "See the Telegram section of .env.example for the two-minute setup."
    );
    process.exit(1);
  }

  const { rows } = await pool().query<{ id: string; name: string; price_effective: string }>(
    "select id, name, price_effective from products order by price desc limit 2"
  );
  const items = rows.map((r, i) => ({
    productId: r.id,
    name: r.name,
    price: Number(r.price_effective),
    currency: "MVR" as const,
    quantity: i === 0 ? 2 : 1,
    image: null,
  }));

  const order = {
    orderNumber: "ATM-TEST-0001",
    items,
    subtotal: items.reduce((s, i) => s + i.price * i.quantity, 0),
    currency: "MVR",
    customer: { name: "Test Customer", email: "test@example.com", phone: "779 1234", address: "Malé, Maldives" },
    paymentMethod: "transfer",
    boliRedeemed: 5000,
    boliDiscountAmount: 50,
    createdAt: new Date().toISOString(),
  } as unknown as Order;

  console.log(renderOrderTelegramMessage(order).replace(/<[^>]+>/g, ""));
  const ok = await sendTelegramMessage(renderOrderTelegramMessage(order));
  console.log(ok ? "\nSent." : "\nFailed — see the error above.");
  process.exit(ok ? 0 : 1);
}
main().catch((err) => {
  console.error(err);
  process.exit(1);
});
