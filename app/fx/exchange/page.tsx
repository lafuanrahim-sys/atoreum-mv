import Link from "next/link";
import { listFxExchanges } from "@/lib/data/fx.server";
import { formatFxDate, formatMvr, formatRate, formatUsd } from "@/lib/fxFormat";
import PageHeader from "@/components/dashboard/PageHeader";

export default async function FxExchangeListPage() {
  const exchanges = await listFxExchanges();

  return (
    <div>
      <PageHeader
        eyebrow="Dollar Exchange"
        title="Exchange Log"
        count={exchanges.length}
        description="USD bought on the parallel market."
        actions={
          <Link
            href="/fx/exchange/new"
            className="bg-gold-deep px-5 py-2.5 text-xs uppercase tracking-[0.15em] text-ink transition-colors hover:bg-gold-deep/90"
          >
            + Log a Purchase
          </Link>
        }
      />

      <div className="mt-8 overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b-2 border-ivory text-left">
              <th className="pb-2 pr-4 font-mono text-[10px] font-normal uppercase tracking-[0.2em] text-ivory-dim">Date</th>
              <th className="pb-2 pr-4 font-mono text-[10px] font-normal uppercase tracking-[0.2em] text-ivory-dim">Counterparty</th>
              <th className="pb-2 pr-4 text-right font-mono text-[10px] font-normal uppercase tracking-[0.2em] text-ivory-dim">USD</th>
              <th className="pb-2 pr-4 text-right font-mono text-[10px] font-normal uppercase tracking-[0.2em] text-ivory-dim">Rate Paid</th>
              <th className="pb-2 pr-4 text-right font-mono text-[10px] font-normal uppercase tracking-[0.2em] text-ivory-dim">MVR Paid</th>
              <th className="pb-2 pr-4 text-right font-mono text-[10px] font-normal uppercase tracking-[0.2em] text-ivory-dim">Profit vs Ceiling</th>
              <th className="pb-2 text-right font-mono text-[10px] font-normal uppercase tracking-[0.2em] text-ivory-dim">Status</th>
            </tr>
          </thead>
          <tbody>
            {exchanges.map((ex) => (
              <tr key={ex.id} className="border-b border-line last:border-b-0">
                <td className="py-3 pr-4 text-ivory-dim">{formatFxDate(ex.tradeDate)}</td>
                <td className="py-3 pr-4">
                  <Link href={`/fx/exchange/${ex.id}/edit`} className="text-ivory transition-colors hover:text-gold-deep">
                    {ex.counterparty}
                  </Link>
                </td>
                <td className="py-3 pr-4 text-right font-mono tabular-nums text-ivory">{formatUsd(ex.usdAmount)}</td>
                <td className="py-3 pr-4 text-right font-mono tabular-nums text-ivory-dim">{formatRate(ex.buyRate)}</td>
                <td className="py-3 pr-4 text-right font-mono tabular-nums text-ivory">{formatMvr(ex.mvrPaid)}</td>
                <td
                  className={`py-3 pr-4 text-right font-mono tabular-nums ${
                    ex.profitVsCeiling >= 0 ? "text-gold-deep" : "text-red-400"
                  }`}
                >
                  {ex.profitVsCeiling >= 0 ? "" : "−"}
                  {formatMvr(Math.abs(ex.profitVsCeiling))}
                </td>
                <td className="py-3 text-right font-mono text-[10px] uppercase tracking-[0.15em] text-ivory-dim">
                  {ex.sellRate !== null ? "Sold" : "Held"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {exchanges.length === 0 && <p className="mt-6 text-sm text-ivory-dim">No purchases logged yet — log the first one above.</p>}
    </div>
  );
}
