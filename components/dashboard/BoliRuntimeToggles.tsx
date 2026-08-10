"use client";

import { useState, useTransition } from "react";
import { useToast } from "@/components/dashboard/ToastProvider";
import { setRuntimeConfigAction, clearRuntimeConfigAction } from "@/app/actions/boliAdmin";
import type { RuntimeConfigRow, RuntimeConfigKey } from "@/lib/boli/runtimeConfig.server";

const LABELS: Record<RuntimeConfigKey, string> = {
  game_enabled: "Sangu Dive enabled",
  weekly_cap: "Weekly game Sangu cap",
  monthly_cap: "Monthly game Sangu cap",
  global_daily_budget: "Global daily game Sangu budget",
};

/** Live, no-deploy toggles for the kill switch and the three spend caps (BOLI_SPEC.md §5.5, §8). */
export default function BoliRuntimeToggles({ rows }: { rows: RuntimeConfigRow[] }) {
  return (
    <ul className="flex flex-col divide-y divide-line border-y border-line">
      {rows.map((row) => (
        <ToggleRow key={row.key} row={row} />
      ))}
    </ul>
  );
}

function ToggleRow({ row }: { row: RuntimeConfigRow }) {
  const [isPending, startTransition] = useTransition();
  const [draft, setDraft] = useState(String(row.value));
  const { showToast } = useToast();

  const isBoolean = row.key === "game_enabled";

  const save = (value: boolean | number) => {
    startTransition(async () => {
      try {
        await setRuntimeConfigAction(row.key, value);
        showToast(`${LABELS[row.key]} updated.`, "success");
      } catch (err) {
        showToast(err instanceof Error ? err.message : "Failed to update.", "error");
      }
    });
  };

  const clear = () => {
    startTransition(async () => {
      try {
        await clearRuntimeConfigAction(row.key);
        showToast(`${LABELS[row.key]} reverted to default.`, "success");
      } catch (err) {
        showToast(err instanceof Error ? err.message : "Failed to revert.", "error");
      }
    });
  };

  return (
    <li className="flex flex-wrap items-center justify-between gap-4 py-4">
      <div>
        <p className="text-sm text-ivory">{LABELS[row.key]}</p>
        {row.isOverridden && (
          <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.15em] text-gold-deep">
            Overridden{row.updatedBy ? ` by ${row.updatedBy}` : ""}
          </p>
        )}
      </div>
      <div className="flex items-center gap-3">
        {isBoolean ? (
          <button
            type="button"
            disabled={isPending}
            onClick={() => save(row.value !== true)}
            aria-pressed={row.value === true}
            className={`px-4 py-1.5 font-mono text-[11px] uppercase tracking-[0.12em] transition-colors disabled:opacity-50 ${
              row.value === true ? "bg-gold-deep text-ink" : "border border-line text-ivory-dim hover:text-ivory"
            }`}
          >
            {row.value === true ? "On" : "Off"}
          </button>
        ) : (
          <>
            <input
              type="number"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              className="w-28 border-b border-line bg-transparent px-1 py-1 font-mono text-sm text-ivory tabular-nums focus:border-gold-deep focus:outline-none"
            />
            <button
              type="button"
              disabled={isPending}
              onClick={() => save(Number(draft))}
              className="bg-gold-deep px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.12em] text-ink transition-colors hover:bg-gold-deep/90 disabled:opacity-50"
            >
              Save
            </button>
          </>
        )}
        {row.isOverridden && (
          <button
            type="button"
            disabled={isPending}
            onClick={clear}
            className="font-mono text-[11px] uppercase tracking-[0.12em] text-ivory-dim transition-colors hover:text-red-400 disabled:opacity-50"
          >
            Reset
          </button>
        )}
      </div>
    </li>
  );
}
