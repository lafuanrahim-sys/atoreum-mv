import Link from "next/link";
import { getAllProducts } from "@/lib/data/products.server";
import PageHeader from "@/components/dashboard/PageHeader";
import ManualSaleForm from "@/components/dashboard/ManualSaleForm";

/**
 * A sale that came in some other way — an Instagram message, a phone call,
 * someone asking in person.
 *
 * It becomes an ordinary order: same numbering, same stock deduction, same
 * invoice run, same figures at the end of the month. What marks it is
 * source: "manual", so the shop can see what each channel actually brings in
 * rather than guessing.
 */
export const metadata = { title: "New sale" };

export default async function NewSalePage() {
  const products = await getAllProducts();

  return (
    <div className="max-w-3xl">
      <Link
        href="/dashboard/orders"
        className="font-mono text-[11px] uppercase tracking-[0.15em] text-ivory-dim transition-colors hover:text-gold"
      >
        &larr; Orders
      </Link>

      <PageHeader
        eyebrow="Manual"
        title="New sale"
        description="For an order taken outside the website. It is recorded like any other: stock comes off, it gets an order number, and it appears in the month's totals."
      />

      <ManualSaleForm
        // Only what the picker needs. Descriptions and ingredients would be
        // several thousand tokens of payload for a form that shows a name and
        // a price.
        products={products.map((p) => ({
          id: p.id,
          name: p.name,
          size: p.size,
          category: p.category,
          priceEffective: p.priceEffective,
          currency: p.currency,
          stockStatus: p.stockStatus,
          stockOnHand: p.stockOnHand,
        }))}
      />
    </div>
  );
}
