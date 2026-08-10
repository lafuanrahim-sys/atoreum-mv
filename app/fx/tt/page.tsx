import Link from "next/link";
import { listFxTtPayments } from "@/lib/data/fx.server";
import { formatFxDate, formatMvr, formatPct, formatRate, formatUsd } from "@/lib/fxFormat";
import PageHeader from "@/components/dashboard/PageHeader";

const th = "pb-2 pr-4 font-mono text-[10px] font-normal uppercase tracking-[0.2em] text-ivory-dim";
const thRight = "pb-2 pr-4 text-right font-mono text-[10px] font-normal uppercase tracking-[0.2em] text-ivory-dim";
const td = "py-3 pr-4 text-ivory-dim";
const tdRight = "py-3 pr-4 text-right font-mono tabular-nums text-ivory-dim";
const tdRightStrong = "py-3 pr-4 text-right font-mono tabular-nums text-ivory";

export default async function FxTtListPage() {
  const payments = await listFxTtPayments();

  return (
    <div>
      <PageHeader
        eyebrow="Dollar Exchange"
        title="TT Log"
        count={payments.length}
        description="TT payments where Bank of Maldives covers part of the transfer in dollars, at its own rate, with every column from the source ledger."
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
              <th className={th}>Date</th>
              <th className={th}>Reference</th>
              <th className={th}>Purpose</th>
              <th className={thRight}>TT Amount</th>
              <th className={thRight}>Bank Support</th>
              <th className={thRight}>USD via Bank</th>
              <th className={thRight}>USD from Own</th>
              <th className={thRight}>Bank TT Rate</th>
              <th className={thRight}>Own USD @ Bank Rate</th>
              <th className={thRight}>Cash Paid</th>
              <th className={thRight}>Market Rate</th>
              <th className={thRight}>Cost of Own USD</th>
              <th className={thRight}>Opportunity Cost</th>
              <th className={thRight}>Total Effective Cost</th>
              <th className={thRight}>Cost w/ No Support</th>
              <th className={thRight}>Cash Saved Today</th>
              <th className={thRight}>Saved (incl. opp.)</th>
              <th className="pb-2 font-mono text-[10px] font-normal uppercase tracking-[0.2em] text-ivory-dim">Notes</th>
            </tr>
          </thead>
          <tbody>
            {payments.map((tt) => (
              <tr key={tt.id} className="border-b border-line last:border-b-0">
                <td className={td}>{formatFxDate(tt.ttDate)}</td>
                <td className="py-3 pr-4">
                  <Link href={`/fx/tt/${tt.id}/edit`} className="text-ivory transition-colors hover:text-gold-deep">
                    {tt.reference}
                  </Link>
                </td>
                <td className={td}>{tt.purpose || "—"}</td>
                <td className={tdRightStrong}>{formatUsd(tt.ttAmount)}</td>
                <td className={tdRight}>{formatPct(tt.supportPct)}</td>
                <td className={tdRight}>{formatUsd(tt.usdViaBank)}</td>
                <td className={tdRight}>{formatUsd(tt.usdFromOwn)}</td>
                <td className={tdRight}>{formatRate(tt.bankRate)}</td>
                <td className={tdRight}>{formatRate(tt.ownUsdAtBankRate)}</td>
                <td className={tdRightStrong}>{formatMvr(tt.cashPaidMvr)}</td>
                <td className={tdRight}>{formatRate(tt.marketRate)}</td>
                <td className={tdRight}>{formatMvr(tt.costOwnUsdMvr)}</td>
                <td className={tdRight}>{formatMvr(tt.opportunityCost)}</td>
                <td className={tdRight}>{formatMvr(tt.totalEffectiveCost)}</td>
                <td className={tdRight}>{formatMvr(tt.costNoSupport)}</td>
                <td className={tdRight}>{formatMvr(tt.cashSavedToday)}</td>
                <td className="py-3 pr-4 text-right font-mono tabular-nums text-gold-deep">{formatMvr(tt.totalSavedInclOpp)}</td>
                <td className="max-w-[200px] truncate py-3 text-ivory-dim" title={tt.notes || undefined}>
                  {tt.notes || "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {payments.length === 0 && <p className="mt-6 text-sm text-ivory-dim">No TTs logged yet. Log the first one above.</p>}
    </div>
  );
}
