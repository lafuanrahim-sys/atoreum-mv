import { formatMvr, formatRate } from "@/lib/fxFormat";

/**
 * The dollar exchange dashboard's signature element (adapted from the
 * ported Atoreum FX spec's "Rate gauge"): a single horizontal scale
 * showing the gap between what was actually paid, on average, and the
 * ceiling rate the store won't buy above — with today's market rate
 * marked alongside for context. Built in this dashboard's own idiom (a
 * thin proportional bar, like the Stock Signal bar on the main dashboard
 * page) rather than importing the source app's own boxed-card styling.
 */
export default function FxRateGauge({
  avgBuyRate,
  ceilingRate,
  marketRate,
  usdBalance,
}: {
  avgBuyRate: number | null;
  ceilingRate: number;
  marketRate: number;
  usdBalance: number;
}) {
  const anchor = avgBuyRate ?? ceilingRate;
  const rangeMin = Math.floor(Math.min(anchor, marketRate, ceilingRate) - 1);
  const rangeMax = Math.ceil(Math.max(anchor, marketRate, ceilingRate) + 1);
  const span = Math.max(rangeMax - rangeMin, 0.01);
  const pct = (rate: number) => Math.min(100, Math.max(0, ((rate - rangeMin) / span) * 100));

  const buyPct = pct(anchor);
  const ceilingPct = pct(ceilingRate);
  const marketPct = pct(marketRate);
  const isGain = anchor <= ceilingRate;
  const fillFrom = Math.min(buyPct, ceilingPct);
  const fillWidth = Math.abs(ceilingPct - buyPct);

  const gapValue = (ceilingRate - anchor) * usdBalance;

  return (
    <div>
      <div className="flex flex-wrap items-baseline gap-x-10 gap-y-4">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-ivory-dim">Weighted Avg. Buy</p>
          <p className="mt-2 font-mono text-3xl font-medium tabular-nums text-ivory">
            {avgBuyRate !== null ? formatRate(avgBuyRate) : "—"}
          </p>
        </div>
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-ivory-dim">Ceiling</p>
          <p className="mt-2 font-mono text-3xl font-medium tabular-nums text-gold-deep">{formatRate(ceilingRate)}</p>
        </div>
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-ivory-dim">Today&apos;s Market</p>
          <p className="mt-2 font-mono text-3xl font-medium tabular-nums text-red-400">{formatRate(marketRate)}</p>
        </div>
      </div>

      {/* Track: filled segment is the gap between the average buy rate and
          the ceiling (gain when buying below ceiling, loss when above),
          a gold-deep notch marks the ceiling itself, a red tick marks
          today's market rate, both independent of the fill. */}
      <div className="relative mt-8 h-1.5 bg-line" role="img" aria-label={`Weighted average buy rate ${avgBuyRate !== null ? formatRate(avgBuyRate) : "unavailable"}, ceiling ${formatRate(ceilingRate)}, market rate ${formatRate(marketRate)}`}>
        <div
          className={`absolute inset-y-0 ${isGain ? "bg-gold-deep" : "bg-red-400"}`}
          style={{ left: `${fillFrom}%`, width: `${fillWidth}%` }}
        />
        <div className="absolute top-1/2 h-3 w-px -translate-y-1/2 bg-gold-deep" style={{ left: `${ceilingPct}%` }} aria-hidden="true" />
        <div className="absolute top-1/2 h-3 w-px -translate-y-1/2 bg-red-400" style={{ left: `${marketPct}%` }} aria-hidden="true" />
        <div
          className="absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-ink bg-ivory"
          style={{ left: `${buyPct}%` }}
          aria-hidden="true"
        />
      </div>
      <div className="mt-2 flex justify-between font-mono text-[10px] tabular-nums text-ivory-dim/70">
        <span>{formatRate(rangeMin)}</span>
        <span>{formatRate(rangeMax)}</span>
      </div>

      <p className="mt-5 text-sm text-ivory-dim">
        {avgBuyRate === null ? (
          "No purchases logged yet."
        ) : isGain ? (
          <>
            Buying {formatRate(ceilingRate - anchor)} under ceiling, worth{" "}
            <span className="font-mono tabular-nums text-gold-deep">MVR {formatMvr(gapValue)}</span> across the current USD
            balance.
          </>
        ) : (
          <>
            Buying {formatRate(anchor - ceilingRate)} over ceiling, costing{" "}
            <span className="font-mono tabular-nums text-red-400">MVR {formatMvr(-gapValue)}</span> across the current USD
            balance.
          </>
        )}
      </p>
    </div>
  );
}
