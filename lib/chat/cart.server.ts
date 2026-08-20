import { getProductById } from "@/lib/data/products.server";

/**
 * The customer's basket, described for the assistant.
 *
 * The cart lives in the browser's own storage and nowhere on the server, so
 * unlike orders it cannot be looked up -- the widget has to send it. That
 * makes it untrusted input, which is why only ids and quantities are read:
 * names and prices are resolved from the catalogue here, so a tampered
 * payload can change what the assistant is willing to talk about and can
 * never change what anything costs.
 *
 * Capped at a sane number of lines. A basket is a handful of items; anything
 * claiming five hundred is either broken or probing, and neither deserves the
 * tokens.
 */

const MAX_LINES = 25;

type ClientCartLine = { productId?: unknown; quantity?: unknown };

export async function describeCart(raw: unknown): Promise<string> {
  if (!Array.isArray(raw) || raw.length === 0) {
    return "THEIR BASKET IS EMPTY. Do not claim anything is in it.";
  }

  const wanted = raw.slice(0, MAX_LINES) as ClientCartLine[];
  const lines: string[] = [];
  let total = 0;

  for (const line of wanted) {
    const id = String(line.productId ?? "").trim().toLowerCase();
    if (!id) continue;

    const quantity = Math.min(Math.max(Math.trunc(Number(line.quantity ?? 1)) || 1, 1), 99);
    const product = await getProductById(id);
    // An id the catalogue does not know is not something the shop sells, so
    // it is not something to describe as being in a basket.
    if (!product) continue;

    const lineTotal = product.priceEffective * quantity;
    total += lineTotal;
    lines.push(`- ${quantity} x ${product.name} (${product.id}) at MVR ${product.priceEffective} each = MVR ${lineTotal}`);
  }

  if (lines.length === 0) {
    return "THEIR BASKET IS EMPTY. Do not claim anything is in it.";
  }

  return [
    "THEIR BASKET RIGHT NOW (you may refer to this; it is what they will pay for):",
    ...lines,
    `Basket total: MVR ${total}`,
    "This total is the goods only. It is GST-inclusive, and any Sangu or voucher comes off at checkout.",
  ].join("\n");
}
