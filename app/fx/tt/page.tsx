import Link from "next/link";
import { listFxTtPayments } from "@/lib/data/fx.server";
import { formatFxDate, formatMvr, formatPct, formatUsd } from "@/lib/fxFormat";
import PageHeader from "@/components/dashboard/PageHeader";

export default async function FxTtListPage() {
  const payments = await listFxTtPayments();

  return (
    <div>
      <PageHeader
        eyebrow="Dollar Exchange"
        title="TT Log"
        count={payments.length}
        description="TT payments where Bank of Maldives covers part of the transfer in dollars, at its own rate."
        actions={
          <Link
            href="/fx/tt/new"
            className="bg-gold-deep px-5 py-2.5 text-xs uppercase tracking-[0.15em] text-ink transition-colors hover:bg-gold-deep/90"
          >
            + Log a TT
          </Link>
        }
      />

      <div className="mt-8 overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b-2 border-ivory text-left">
              <th className="pb-2 pr-4 font-mono text-[10px] font-normal uppercase tracking-[0.2em] text-ivory-dim">Date</th>
              <th className="pb-2 pr-4 font-mono text-[10px] font-normal uppercase tracking-[0.2em] text-ivory-dim">Reference</th>
              <th className="pb-2 pr-4 text-right font-mono text-[10px] font-normal uppercase tracking-[0.2em] text-ivory-dim">TT Amount</th>
              <th className="pb-2 pr-4 text-right font-mono text-[10px] font-normal uppercase tracking-[0.2em] text-ivory-dim">Bank Support</th>
              <th className="pb-2 pr-4 text-right font-mono text-[10px] font-normal uppercase tracking-[0.2em] text-ivory-dim">Cash Paid</th>
              <th className="pb-2 text-right font-mono text-[10px] font-normal uppercase tracking-[0.2em] text-ivory-dim">Saved (incl. opp.)</th>
            </tr>
          </thead>
          <tbody>
            {payments.map((tt) => (
              <tr key={tt.id} className="border-b border-line last:border-b-0">
                <td className="py-3 pr-4 text-ivory-dim">{formatFxDate(tt.ttDate)}</td>
                <td className="py-3 pr-4">
                  <Link href={`/fx/tt/${tt.id}/edit`} className="text-ivory transition-colors hover:text-gold-deep">
                    {tt.reference}
                  </Link>
                  {tt.purpose && <span className="ml-2 text-xs text-ivory-dim">{tt.purpose}</span>}
                </td>
                <td className="py-3 pr-4 text-right font-mono tabular-nums text-ivory">{formatUsd(tt.ttAmount)}</td>
                <td className="py-3 pr-4 text-right font-mono tabular-nums text-ivory-dim">{formatPct(tt.supportPct)}</td>
                <td className="py-3 pr-4 text-right font-mono tabular-nums text-ivory">{formatMvr(tt.cashPaidMvr)}</td>
                <td className="py-3 text-right font-mono tabular-nums text-gold-deep">{formatMvr(tt.totalSavedInclOpp)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {payments.length === 0 && <p className="mt-6 text-sm text-ivory-dim">No TTs logged yet — log the first one above.</p>}
    </div>
  );
}
