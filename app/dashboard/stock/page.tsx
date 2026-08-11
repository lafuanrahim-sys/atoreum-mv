import Link from "next/link";
import PageHeader from "@/components/dashboard/PageHeader";
import StockCountSheet from "@/components/dashboard/StockCountSheet";
import { getCountSheet, listStockCounts, listRecentMovements, getStockTotals } from "@/lib/data/stock.server";

const REASON_LABEL: Record<string, string> = {
  shipment_received: "Shipment received",
  count_adjustment: "Count adjustment",
  sale: "Sale",
  sale_reversal: "Order cancelled",
  manual: "Manual edit",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString();
}

export default async function StockCountPage() {
  const [sheet, counts, movements, totals] = await Promise.all([
    getCountSheet(),
    listStockCounts(8),
    listRecentMovements(25),
    getStockTotals(),
  ]);

  // Asia/Male is the only timezone this store operates in, so the count sheet
  // opens on Malé's today rather than the server's.
  const todayIso = new Intl.DateTimeFormat("en-CA", { timeZone: "Indian/Maldives" }).format(new Date());

  return (
    <div>
      <PageHeader
        eyebrow="Inventory"
        title="Stock Count"
        count={sheet.length}
        description="Type what's actually on the shelf. Anything you leave blank isn't counted, so this works for one shelf or the whole store."
        actions={
          <Link
            href="/dashboard/shipments"
            className="border border-line px-5 py-2.5 text-xs uppercase tracking-[0.15em] text-ivory-dim transition-colors hover:border-gold-deep hover:text-gold-deep"
          >
            Shipments →
          </Link>
        }
      />

      {/* Totals first: how much stock exists and how much has left. Sold is
          taken from the movement ledger net of reversals, so a cancelled
          order does not count as a sale. */}
      <div className="mt-8 grid grid-cols-2 gap-px border border-line bg-line sm:grid-cols-4">
        <StockStat label="Total stock" value={totals.onHand.toLocaleString()} note="units on the shelf" />
        <StockStat label="Sold" value={`- ${totals.sold.toLocaleString()}`} note="units, net of cancellations" tone="sold" />
        <StockStat label="Low stock" value={totals.productsLow.toLocaleString()} note="products at 2 or fewer" tone={totals.productsLow > 0 ? "warn" : undefined} />
        <StockStat label="Out of stock" value={totals.productsOut.toLocaleString()} note="products at zero" tone={totals.productsOut > 0 ? "bad" : undefined} />
      </div>

      <div className="mt-8">
        <StockCountSheet rows={sheet} todayIso={todayIso} />
      </div>

      <div className="mt-14 flex flex-col gap-12 lg:flex-row lg:gap-0">
        <div className="lg:flex-1 lg:pr-10">
          <h2 className="font-mono text-[10px] uppercase tracking-[0.2em] text-ivory-dim">Recent Stock Movements</h2>
          {movements.length === 0 ? (
            <p className="mt-3 text-sm text-ivory-dim">No stock movements recorded yet.</p>
          ) : (
            <ul className="mt-4 flex flex-col border-t border-line">
              {movements.map((m) => (
                <li key={m.id} className="flex items-center justify-between gap-4 border-b border-line py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm text-ivory">{m.productName}</p>
                    <p className="font-mono text-[11px] text-ivory-dim">
                      {REASON_LABEL[m.reason] ?? m.reason} · {formatDate(m.createdAt)}
                      {m.createdBy ? ` · ${m.createdBy}` : ""}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 font-mono text-sm tabular-nums ${m.delta > 0 ? "text-gold-deep" : "text-red-400"}`}
                  >
                    {m.delta > 0 ? "+" : ""}
                    {m.delta}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="hidden w-px shrink-0 bg-line lg:block" aria-hidden="true" />

        <div className="lg:w-96 lg:shrink-0 lg:pl-10">
          <h2 className="font-mono text-[10px] uppercase tracking-[0.2em] text-ivory-dim">Past Counts</h2>
          {counts.length === 0 ? (
            <p className="mt-3 text-sm text-ivory-dim">No counts applied yet.</p>
          ) : (
            <ul className="mt-4 flex flex-col border-t border-line">
              {counts.map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-4 border-b border-line py-3">
                  <div className="min-w-0">
                    <p className="text-sm text-ivory">{c.countedOn}</p>
                    <p className="truncate font-mono text-[11px] text-ivory-dim">
                      {c.linesCounted} counted{c.createdBy ? ` · ${c.createdBy}` : ""}
                      {c.notes ? ` · ${c.notes}` : ""}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 font-mono text-xs tabular-nums ${
                      c.netVariance === 0 ? "text-ivory-dim" : c.netVariance > 0 ? "text-gold-deep" : "text-red-400"
                    }`}
                  >
                    {c.netVariance > 0 ? "+" : ""}
                    {c.netVariance}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function StockStat({
  label,
  value,
  note,
  tone,
}: {
  label: string;
  value: string;
  note: string;
  tone?: "sold" | "warn" | "bad";
}) {
  const colour =
    tone === "bad" ? "text-red-400" : tone === "warn" ? "text-sand" : tone === "sold" ? "text-ivory-dim" : "text-ivory";
  return (
    <div className="bg-ink p-5">
      <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ivory-dim">{label}</p>
      <p className={`mt-2 font-mono text-2xl tabular-nums ${colour}`}>{value}</p>
      <p className="mt-1 text-[11px] text-ivory-dim/70">{note}</p>
    </div>
  );
}
