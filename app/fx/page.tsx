import Link from "next/link";
import { getFxDashboard, getFxSettings, listFxExchanges, listFxTtPayments } from "@/lib/data/fx.server";
import { formatFxDate, formatMvr, formatUsd } from "@/lib/fxFormat";
import PageHeader from "@/components/dashboard/PageHeader";
import DashboardReveal from "@/components/dashboard/DashboardReveal";
import FxRateGauge from "@/components/dashboard/FxRateGauge";

/**
 * Dollar exchange tracker overview — ported from the standalone Atoreum FX
 * app's own "/" dashboard route (see D:\atoreum-fx\CLAUDE.md) directly into
 * this admin dashboard. Logs USD bought on the parallel market and TT
 * payments where Bank of Maldives covers part of the transfer in dollars;
 * every figure below is read straight off a Postgres generated column
 * (lib/data/schema.sql's fx_* tables), never recomputed here.
 */
export default async function FxDashboardPage() {
  const [summary, settings, exchanges, ttPayments] = await Promise.all([
    getFxDashboard(),
    getFxSettings(),
    listFxExchanges(),
    listFxTtPayments(),
  ]);

  const recentExchanges = exchanges.slice(0, 5);
  const recentTt = ttPayments.slice(0, 5);

  return (
    <div>
      <PageHeader
        eyebrow="Internal · Two Users"
        title="Dollar Exchange"
        description="USD bought on the parallel market, and TT payments where Bank of Maldives covers part of the transfer in dollars."
        actions={
          <>
            <Link
              href="/fx/exchange/new"
              className="bg-gold-deep px-5 py-2.5 text-xs uppercase tracking-[0.15em] text-ink transition-colors hover:bg-gold-deep/90"
            >
              + Log a Purchase
            </Link>
            <Link
              href="/fx/tt/new"
              className="border border-line px-5 py-2.5 text-xs uppercase tracking-[0.15em] text-ivory-dim transition-colors hover:border-gold-deep hover:text-gold-deep"
            >
              + Log a TT
            </Link>
          </>
        }
      />

      {/* Signature element — see FxRateGauge's own comment. */}
      <DashboardReveal className="mt-10 border-b border-line pb-10">
        <FxRateGauge
          avgBuyRate={summary.avgBuyRate}
          ceilingRate={settings.ceilingRate}
          marketRate={settings.latestMarketRate}
          usdBalance={summary.usdBalance}
        />
      </DashboardReveal>

      {/* Headline figures — hairline-divided, matching the main dashboard's own stat row rather than boxed cards. */}
      <DashboardReveal className="mt-10 grid grid-cols-2 gap-x-8 gap-y-8 border-b border-line pb-10 sm:grid-cols-3 lg:grid-cols-6">
        <Stat label="USD Balance" value={formatUsd(summary.usdBalance)} unit="USD" />
        <Stat label="MVR Paid" value={formatMvr(summary.mvrPaid)} unit="MVR" />
        <Stat
          label="Profit vs Ceiling"
          value={formatMvr(Math.abs(summary.profitVsCeiling))}
          unit="MVR"
          tone={summary.profitVsCeiling >= 0 ? "gain" : "loss"}
          negative={summary.profitVsCeiling < 0}
        />
        <Stat
          label="Profit vs Market"
          value={formatMvr(Math.abs(summary.profitVsMarket))}
          unit="MVR"
          tone={summary.profitVsMarket >= 0 ? "gain" : "loss"}
          negative={summary.profitVsMarket < 0}
        />
        <Stat label="TT Cash Saved" value={formatMvr(summary.cashSaved)} unit="MVR" tone="gain" />
        <Stat label="Total Value Created" value={formatMvr(summary.totalValueCreated)} unit="MVR" tone="gain" />
      </DashboardReveal>

      <div className="mt-12 flex flex-col gap-12 lg:flex-row lg:gap-0">
        <div className="lg:flex-1 lg:pr-10">
          <div className="flex items-baseline justify-between">
            <h2 className="font-admin-heading text-xl font-semibold text-ivory">Recent Exchanges</h2>
            <Link href="/fx/exchange" className="font-mono text-[11px] uppercase tracking-[0.15em] text-gold-deep hover:underline">
              View all →
            </Link>
          </div>
          <div className="mt-5 overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b-2 border-ivory text-left">
                  <th className="pb-2 pr-4 font-mono text-[10px] font-normal uppercase tracking-[0.2em] text-ivory-dim">Date</th>
                  <th className="pb-2 pr-4 font-mono text-[10px] font-normal uppercase tracking-[0.2em] text-ivory-dim">Counterparty</th>
                  <th className="pb-2 pr-4 text-right font-mono text-[10px] font-normal uppercase tracking-[0.2em] text-ivory-dim">USD</th>
                  <th className="pb-2 text-right font-mono text-[10px] font-normal uppercase tracking-[0.2em] text-ivory-dim">Rate</th>
                </tr>
              </thead>
              <tbody>
                {recentExchanges.map((ex) => (
                  <tr key={ex.id} className="border-b border-line last:border-b-0">
                    <td className="py-3 pr-4 text-ivory-dim">{formatFxDate(ex.tradeDate)}</td>
                    <td className="py-3 pr-4">
                      <Link href={`/fx/exchange/${ex.id}/edit`} className="text-ivory transition-colors hover:text-gold-deep">
                        {ex.counterparty}
                      </Link>
                    </td>
                    <td className="py-3 pr-4 text-right font-mono tabular-nums text-ivory">{formatUsd(ex.usdAmount)}</td>
                    <td className="py-3 text-right font-mono tabular-nums text-ivory-dim">{ex.buyRate.toFixed(2)}</td>
                  </tr>
                ))}
                {recentExchanges.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-6 text-sm text-ivory-dim">
                      No purchases logged yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="hidden w-px shrink-0 bg-line lg:block" aria-hidden="true" />

        <div className="lg:w-96 lg:shrink-0 lg:pl-10">
          <div className="flex items-baseline justify-between">
            <h2 className="font-admin-heading text-xl font-semibold text-ivory">Recent TTs</h2>
            <Link href="/fx/tt" className="font-mono text-[11px] uppercase tracking-[0.15em] text-gold-deep hover:underline">
              View all →
            </Link>
          </div>
          <ul className="mt-5 flex flex-col border-t border-line">
            {recentTt.map((tt) => (
              <li key={tt.id} className="flex items-center justify-between gap-3 border-b border-line py-3">
                <div className="min-w-0">
                  <Link
                    href={`/fx/tt/${tt.id}/edit`}
                    className="block truncate text-sm text-ivory transition-colors hover:text-gold-deep"
                  >
                    {tt.reference}
                  </Link>
                  <span className="text-xs text-ivory-dim">{formatFxDate(tt.ttDate)}</span>
                </div>
                <span className="shrink-0 font-mono text-xs tabular-nums text-ivory-dim">{formatMvr(tt.ttAmount)} USD</span>
              </li>
            ))}
            {recentTt.length === 0 && <li className="py-6 text-sm text-ivory-dim">No TTs logged yet.</li>}
          </ul>

          <Link
            href="/fx/settings"
            className="mt-8 inline-block font-mono text-[11px] uppercase tracking-[0.15em] text-gold-deep hover:underline"
          >
            Rates & Settings →
          </Link>
        </div>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  unit,
  tone = "default",
  negative = false,
}: {
  label: string;
  value: string;
  unit: string;
  tone?: "default" | "gain" | "loss";
  negative?: boolean;
}) {
  const toneClass = tone === "gain" ? "text-gold-deep" : tone === "loss" ? "text-red-400" : "text-ivory";
  return (
    <div>
      <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ivory-dim">{label}</p>
      <p className={`mt-2 flex items-baseline gap-1 font-mono text-xl font-medium tabular-nums md:text-2xl ${toneClass}`}>
        {negative && "−"}
        {value}
        <span className="text-[10px] uppercase tracking-[0.15em] text-ivory-dim">{unit}</span>
      </p>
    </div>
  );
}
