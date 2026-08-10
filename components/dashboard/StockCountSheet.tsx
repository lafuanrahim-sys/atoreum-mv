"use client";

import { useMemo, useState, useTransition } from "react";
import { useToast } from "@/components/dashboard/ToastProvider";
import { applyStockCountAction } from "@/app/actions/stock";
import type { CountSheetRow } from "@/lib/data/stock.server";

/**
 * The stocktake, on one screen: every product with what the system believes
 * it holds, one box to type what's actually on the shelf, and the variance
 * computed as you type so a miscount is obvious before it's committed.
 *
 * Only products you actually type a number into are counted. Leaving a row
 * blank means "didn't count this one" rather than "counted zero" -- which is
 * what makes a single-shelf spot check and a full stocktake the same screen.
 * Counting something as genuinely zero is done by typing 0.
 */
export default function StockCountSheet({ rows, todayIso }: { rows: CountSheetRow[]; todayIso: string }) {
  const [counted, setCounted] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState("");
  const [countedOn, setCountedOn] = useState(todayIso);
  const [query, setQuery] = useState("");
  const [onlyVariance, setOnlyVariance] = useState(false);
  const [isPending, startTransition] = useTransition();
  const { showToast } = useToast();

  const entered = useMemo(
    () =>
      Object.entries(counted)
        .filter(([, v]) => v.trim() !== "" && Number.isFinite(Number(v)))
        .map(([productId, v]) => ({ productId, countedQty: Math.max(0, Math.floor(Number(v))) })),
    [counted]
  );

  const varianceById = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of rows) {
      const raw = counted[r.productId];
      if (raw === undefined || raw.trim() === "" || !Number.isFinite(Number(raw))) continue;
      map.set(r.productId, Math.max(0, Math.floor(Number(raw))) - r.systemQty);
    }
    return map;
  }, [counted, rows]);

  const linesWithVariance = [...varianceById.values()].filter((v) => v !== 0).length;
  const netVariance = [...varianceById.values()].reduce((a, b) => a + b, 0);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (onlyVariance && !(varianceById.get(r.productId) ?? 0)) return false;
      if (!q) return true;
      return r.name.toLowerCase().includes(q) || r.sku.toLowerCase().includes(q) || r.category.toLowerCase().includes(q);
    });
  }, [rows, query, onlyVariance, varianceById]);

  const submit = () => {
    if (entered.length === 0) {
      showToast("Enter a counted quantity for at least one product.", "error");
      return;
    }
    startTransition(async () => {
      try {
        const res = await applyStockCountAction({ countedOn, notes, lines: entered });
        showToast(
          res.adjusted === 0
            ? `Count applied. All ${entered.length} counted product(s) matched the system.`
            : `Count applied. ${res.adjusted} product(s) adjusted, net ${res.netVariance > 0 ? "+" : ""}${res.netVariance} units.`,
          "success"
        );
        setCounted({});
        setNotes("");
      } catch (err) {
        showToast(err instanceof Error ? err.message : "Couldn't apply the count.", "error");
      }
    });
  };

  return (
    <div>
      <div className="flex flex-wrap items-end gap-6 border border-line p-5">
        <label className="flex flex-col gap-1.5">
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-ivory-dim">Count date</span>
          <input
            type="date"
            value={countedOn}
            onChange={(e) => setCountedOn(e.target.value)}
            className="border-b border-line bg-transparent px-1 py-2 font-mono text-sm text-ivory focus:border-gold-deep focus:outline-none"
          />
        </label>
        <label className="flex min-w-[220px] flex-1 flex-col gap-1.5">
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-ivory-dim">Note (optional)</span>
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Monthly stocktake, back shelf recount…"
            className="border-b border-line bg-transparent px-1 py-2 text-sm text-ivory placeholder:text-ivory-dim/60 focus:border-gold-deep focus:outline-none"
          />
        </label>
        <div className="flex items-baseline gap-6">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ivory-dim">Counted</p>
            <p className="mt-1 font-mono text-lg tabular-nums text-ivory">
              {entered.length}
              <span className="text-xs text-ivory-dim"> / {rows.length}</span>
            </p>
          </div>
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ivory-dim">Off by</p>
            <p className={`mt-1 font-mono text-lg tabular-nums ${linesWithVariance ? "text-gold-deep" : "text-ivory"}`}>
              {linesWithVariance}
            </p>
          </div>
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ivory-dim">Net units</p>
            <p
              className={`mt-1 font-mono text-lg tabular-nums ${
                netVariance === 0 ? "text-ivory" : netVariance > 0 ? "text-gold-deep" : "text-red-400"
              }`}
            >
              {netVariance > 0 ? "+" : ""}
              {netVariance}
            </p>
          </div>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-4">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter by name, SKU, or category…"
          className="min-w-[240px] flex-1 border-b border-line bg-transparent px-1 py-2 text-sm text-ivory placeholder:text-ivory-dim/60 focus:border-gold-deep focus:outline-none"
        />
        <label className="flex cursor-pointer items-center gap-2 font-mono text-[10px] uppercase tracking-[0.15em] text-ivory-dim">
          <input type="checkbox" checked={onlyVariance} onChange={(e) => setOnlyVariance(e.target.checked)} />
          Only show differences
        </label>
        <button
          type="button"
          disabled={isPending || entered.length === 0}
          onClick={submit}
          className="bg-gold-deep px-5 py-2.5 font-mono text-xs uppercase tracking-[0.15em] text-ink transition-colors hover:bg-gold-deep/90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isPending ? "Applying…" : `Apply count (${entered.length})`}
        </button>
      </div>

      <div className="mt-6 overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b-2 border-ivory text-left">
              <th className="pb-2 pr-4 font-mono text-[10px] font-normal uppercase tracking-[0.2em] text-ivory-dim">Product</th>
              <th className="pb-2 pr-4 font-mono text-[10px] font-normal uppercase tracking-[0.2em] text-ivory-dim">SKU</th>
              <th className="pb-2 pr-4 font-mono text-[10px] font-normal uppercase tracking-[0.2em] text-ivory-dim">Category</th>
              <th className="pb-2 pr-4 text-right font-mono text-[10px] font-normal uppercase tracking-[0.2em] text-ivory-dim">System</th>
              <th className="pb-2 pr-4 text-right font-mono text-[10px] font-normal uppercase tracking-[0.2em] text-ivory-dim">Counted</th>
              <th className="pb-2 text-right font-mono text-[10px] font-normal uppercase tracking-[0.2em] text-ivory-dim">Difference</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((r) => {
              const variance = varianceById.get(r.productId);
              return (
                <tr key={r.productId} className="border-b border-line last:border-b-0">
                  <td className="py-2.5 pr-4 text-ivory">{r.name}</td>
                  <td className="py-2.5 pr-4 font-mono text-xs text-ivory-dim">{r.sku}</td>
                  <td className="py-2.5 pr-4 text-xs text-ivory-dim">{r.category}</td>
                  <td className="py-2.5 pr-4 text-right font-mono tabular-nums text-ivory-dim">{r.systemQty}</td>
                  <td className="py-2.5 pr-4 text-right">
                    <input
                      type="number"
                      min={0}
                      step={1}
                      inputMode="numeric"
                      value={counted[r.productId] ?? ""}
                      onChange={(e) => setCounted((prev) => ({ ...prev, [r.productId]: e.target.value }))}
                      aria-label={`Counted quantity for ${r.name}`}
                      className="w-20 border-b border-line bg-transparent px-1 py-1 text-right font-mono text-sm tabular-nums text-ivory placeholder:text-ivory-dim/40 focus:border-gold-deep focus:outline-none"
                    />
                  </td>
                  <td
                    className={`py-2.5 text-right font-mono tabular-nums ${
                      variance === undefined
                        ? "text-ivory-dim/40"
                        : variance === 0
                          ? "text-ivory-dim"
                          : variance > 0
                            ? "text-gold-deep"
                            : "text-red-400"
                    }`}
                  >
                    {variance === undefined ? "" : variance === 0 ? "Match" : `${variance > 0 ? "+" : ""}${variance}`}
                  </td>
                </tr>
              );
            })}
            {visible.length === 0 && (
              <tr>
                <td colSpan={6} className="py-6 text-sm text-ivory-dim">
                  Nothing matches that filter.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
