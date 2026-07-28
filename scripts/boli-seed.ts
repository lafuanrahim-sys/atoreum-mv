import "./boli-env";
import { getAllOrders } from "../lib/data/orders.server";
import { getUserById, getUserByEmail } from "../lib/data/users.server";
import { creditPurchaseEarn } from "../lib/boli/ledger.server";
import { pool } from "../lib/boli/db";
import { PURCHASE_EARN_PER_MVR } from "../lib/boli/config";

/**
 * Seeds Boli balances from the store's EXISTING orders rather than
 * inventing synthetic data — every order already in data/orders.json that
 * is "Completed" and belongs to a registered account gets the Boli it
 * would have earned had Boli existed when it was placed. This doubles as
 * the real launch-day backfill (every Completed order predates Boli and
 * never got credited) and as realistic seed data for local development.
 *
 * Idempotent: creditPurchaseEarn()'s idempotency key is per-order
 * (`order:{orderId}:delivered`), so re-running this is always safe.
 *
 * Run with `npm run boli:seed`.
 */
async function main() {
  const orders = (await getAllOrders()).filter((o) => o.status === "Completed");
  let credited = 0;
  let skippedNoAccount = 0;
  let skippedZero = 0;

  for (const order of orders) {
    const user = (order.userId ? await getUserById(order.userId) : null) ?? (await getUserByEmail(order.customer.email));
    if (!user) {
      skippedNoAccount++;
      continue;
    }

    const entry = await creditPurchaseEarn({
      userId: user.id,
      orderId: order.id,
      orderSubtotalMvr: order.subtotal,
      boliDiscountMvr: order.boliDiscountAmount ?? 0,
    });

    if (entry) {
      credited++;
      console.log(`credited ${entry.delta} Boli to ${user.email} for ${order.orderNumber}`);
    } else {
      skippedZero++;
    }
  }

  console.log(
    `Done. ${orders.length} completed order(s): ${credited} credited, ${skippedNoAccount} skipped (guest/no account), ${skippedZero} skipped (below MVR ${PURCHASE_EARN_PER_MVR} minimum increment).`
  );
  await pool().end();
}

main().catch(async (err) => {
  console.error(err);
  process.exitCode = 1;
  await pool().end();
});
