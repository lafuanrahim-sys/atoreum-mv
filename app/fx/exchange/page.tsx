import Link from "next/link";
import { listFxExchanges } from "@/lib/data/fx.server";
import { formatFxDate, formatMvr, formatRate, formatUsd } from "@/lib/fxFormat";
import PageHeader from "@/components/dashboard/PageHeader";

const th = "pb-2 pr-4 font-mono text-[10px] font-normal uppercase tracking-[0.2em] text-ivory-dim";
const thRight = "pb-2 pr-4 text-right font-mono text-[10px] font-normal uppercase tracking-[0.2em] text-ivory-dim";
const td = "py-3 pr-4 text-ivory-dim";
const tdRight = "py-3 pr-4 text-right font-mono tabular-nums text-ivory-dim";
const tdRightStrong = "py-3 pr-4 text-right font-mono tabular-nums text-ivory";

export default async function FxExchangeListPage() {
  const exchanges = await listFxExchanges();

  return (
    <div>
      <PageHeader
        eyebrow="Dollar Exchange"
        title="Exchange Log"
        count={exchanges.length}
        description="USD bought on the parallel market — every column from the source ledger."
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
              <th className={th}>Date</th>
              <th className={th}>Counterparty</th>
              <th className={thRight}>USD Bought</th>
              <th className={thRight}>Our Buy Rate</th>
              <th className={thRight}>Market Rate</th>
              <th className={thRight}>MVR Paid</th>
              <th className={thRight}>Ceiling Rate</th>
              <th className={thRight}>Cost at Ceiling</th>
              <th className={thRight}>Profit vs Ceiling</th>
              <th className={thRight}>Unrealized vs Market</th>
              <th className={thRight}>Sell Rate</th>
              <th className={thRight}>Realized Profit</th>
              <th className="pb-2 font-mono text-[10px] font-normal uppercase tracking-[0.2em] text-ivory-dim">Notes</th>
            </tr>
          </thead>
          <tbody>
            {exchanges.map((ex) => (
              <tr key={ex.id} className="border-b border-line last:border-b-0">
                <td className={td}>{formatFxDate(ex.tradeDate)}</td>
                <td className="py-3 pr-4">
                  <Link href={`/fx/exchange/${ex.id}/edit`} className="text-ivory transition-colors hover:text-gold-deep">
                    {ex.counterparty}
                  </Link>
                </td>
                <td className={tdRightStrong}>{formatUsd(ex.usdAmount)}</td>
                <td className={tdRight}>{formatRate(ex.buyRate)}</td>
                <td className={tdRight}>{formatRate(ex.marketRate)}</td>
                <td className={tdRightStrong}>{formatMvr(ex.mvrPaid)}</td>
                <td className={tdRight}>{formatRate(ex.ceilingRate)}</td>
                <td className={tdRight}>{formatMvr(ex.costAtCeiling)}</td>
                <td
                  className={`py-3 pr-4 text-right font-mono tabular-nums ${
                    ex.profitVsCeiling >= 0 ? "text-gold-deep" : "text-red-400"
                  }`}
                >
                  {ex.profitVsCeiling >= 0 ? "" : "−"}
                  {formatMvr(Math.abs(ex.profitVsCeiling))}
                </td>
                <td
                  className={`py-3 pr-4 text-right font-mono tabular-nums ${
                    ex.unrealizedVsMarket >= 0 ? "text-gold-deep" : "text-red-400"
                  }`}
                >
                  {ex.unrealizedVsMarket >= 0 ? "" : "−"}
                  {formatMvr(Math.abs(ex.unrealizedVsMarket))}
                </td>
                <td className={tdRight}>{ex.sellRate !== null ? formatRate(ex.sellRate) : "—"}</td>
                <td className={tdRight}>
                  {ex.realizedProfit !== null ? (
                    <span className={ex.realizedProfit >= 0 ? "text-gold-deep" : "text-red-400"}>
                      {ex.realizedProfit >= 0 ? "" : "−"}
                      {formatMvr(Math.abs(ex.realizedProfit))}
                    </span>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="max-w-[200px] truncate py-3 text-ivory-dim" title={ex.notes || undefined}>
                  {ex.notes || "—"}
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
