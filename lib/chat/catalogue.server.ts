import { unstable_cache } from "next/cache";
import { getAllProducts } from "@/lib/data/products.server";
import { getSettings } from "@/lib/data/settings.server";

/**
 * The catalogue, flattened into something an assistant can read.
 *
 * This is the assistant's only source of product truth. It is deliberately
 * built from getAllProducts() rather than a hand-kept summary, because a
 * hand-kept summary is a second copy of the catalogue that silently goes
 * stale, and the failure mode is the assistant quoting a discontinued product
 * at last season's price.
 *
 * Out-of-stock products stay in the list, marked. Dropping them would make the
 * assistant answer "we don't sell that" to a customer asking about something
 * the shop plainly does sell, which reads as incompetence rather than as the
 * temporary gap it is.
 */

function line(p: Awaited<ReturnType<typeof getAllProducts>>[number]): string {
  const stock =
    p.stockStatus === "out-of-stock" ? "OUT OF STOCK" :
    p.stockStatus === "low-stock" ? "low stock" : "in stock";

  // Only mention a discount when there is one, and describe the shape of it
  // the same way the product card does.
  const wasPrice =
    p.priceEffective < p.price ? ` (was MVR ${p.price}, on offer)` : "";

  /**
   * The hero ingredient, or nothing.
   *
   * This field was 48% of the catalogue, and a large part of that was paying
   * to say nothing: seventeen products carry "Full ingredient list (INCI)
   * pending confirmation from the manufacturer", which cost ~670 tokens on
   * every single request and told the assistant precisely as much as an empty
   * string would. Another ~290 went on repeating the words "Formulated around"
   * seventy-two times.
   *
   * A placeholder is dropped entirely; a real ingredient is reduced to the
   * ingredient. The assistant knows what column it is reading.
   */
  const firstSentence = p.ingredients.split(/(?<=\.)\s/)[0]?.trim() ?? "";
  const hero = /pending confirmation|INCI\) pending|not yet|unavailable/i.test(firstSentence)
    ? ""
    : firstSentence.replace(/^Formulated around\s+/i, "").replace(/\.$/, "");

  return [
    `${p.id} | ${p.name}`,
    p.size,
    p.category,
    `MVR ${p.priceEffective}${wasPrice}`,
    stock,
    p.description,
    hero,
  ]
    .filter(Boolean)
    .join(" | ");
}

async function build(): Promise<string> {
  const products = await getAllProducts();
  const rows = products
    .slice()
    .sort((a, b) => a.category.localeCompare(b.category) || a.priceEffective - b.priceEffective)
    .map(line);

  return [
    "Format: id | name | size | category | price | stock | description | key ingredient",
    "",
    ...rows,
  ].join("\n");
}

/**
 * Rebuilt at most once a minute. Stock and prices move during the day, and an
 * assistant that recommends something sold out an hour ago creates work for
 * whoever answers the follow-up.
 */
export const getCatalogueContext = unstable_cache(build, ["chat-catalogue"], {
  revalidate: 60,
  tags: ["products"],
});

/**
 * Bank details, read live rather than baked into the prompt.
 *
 * These sit in the database because they change, and they changed recently.
 * An assistant reciting a stale account number sends a customer's money to the
 * wrong place, so this is the one fact worth paying a query for every time.
 */
export async function getPaymentContext(): Promise<string> {
  const s = await getSettings();
  return [
    "BANK TRANSFER DETAILS (quote these exactly, never from memory)",
    `- Bank: ${s.bankName}`,
    `- Account name: ${s.accountName}`,
    `- Account number: ${s.accountNumber}`,
  ].join("\n");
}
