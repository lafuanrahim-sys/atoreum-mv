"use client";

import type { FxExchange } from "@/lib/types";
import { formatMvr } from "@/lib/fxFormat";
import { ComputedField, FormSection, TextArea, TextField } from "@/components/admin/AdminFormFields";

/**
 * Shared create/edit form for a parallel-market USD purchase. The parent
 * page binds `action` to either createFxExchangeAction or
 * updateFxExchangeAction (bound with the row id via .bind()) — same
 * pattern as ProductForm.tsx.
 */
export default function FxExchangeForm({
  exchange,
  action,
  defaultCeilingRate,
  defaultMarketRate,
}: {
  exchange?: FxExchange;
  action: (formData: FormData) => void | Promise<void>;
  /** Pre-fills a new row from Dollar Exchange → Settings, per the ported spec. */
  defaultCeilingRate: number;
  defaultMarketRate: number;
}) {
  const today = new Date().toISOString().slice(0, 10);

  return (
    <form action={action} className="flex max-w-2xl flex-col gap-10">
      <FormSection eyebrow="01" title="The Purchase">
        <div className="grid grid-cols-2 gap-5">
          <TextField label="Date" name="tradeDate" type="date" defaultValue={exchange?.tradeDate ?? today} required />
          <TextField label="Counterparty" name="counterparty" defaultValue={exchange?.counterparty} required />
        </div>
        <div className="grid grid-cols-2 gap-5 sm:grid-cols-3">
          <TextField label="USD Amount" name="usdAmount" type="number" step="0.01" defaultValue={exchange?.usdAmount} required />
          <TextField label="Rate You Paid" name="buyRate" type="number" step="0.01" defaultValue={exchange?.buyRate} required />
          <TextField
            label="Today's Market Rate"
            name="marketRate"
            type="number"
            step="0.01"
            defaultValue={exchange?.marketRate ?? defaultMarketRate}
            required
          />
        </div>
        <TextField
          label="Ceiling Rate (snapshotted for this row)"
          name="ceilingRate"
          type="number"
          step="0.01"
          defaultValue={exchange?.ceilingRate ?? defaultCeilingRate}
          hint="Changing the ceiling in Settings later doesn't alter rows already logged."
          required
        />
        <TextArea label="Notes" name="notes" defaultValue={exchange?.notes} rows={2} />
      </FormSection>

      <FormSection eyebrow="02" title="Resale (optional)">
        <TextField
          label="Rate You Sold At"
          name="sellRate"
          type="number"
          step="0.01"
          defaultValue={exchange?.sellRate ?? undefined}
          hint="Leave blank while this USD is still held. Set it once it's resold to record a realized profit."
        />
      </FormSection>

      {exchange && (
        <FormSection eyebrow="03" title="Calculated">
          <div className="grid grid-cols-2 gap-5 sm:grid-cols-3">
            <ComputedField label="MVR Paid" value={formatMvr(exchange.mvrPaid)} />
            <ComputedField label="Cost at Ceiling" value={formatMvr(exchange.costAtCeiling)} />
            <ComputedField
              label="Profit vs Ceiling"
              value={formatMvr(Math.abs(exchange.profitVsCeiling))}
              tone={exchange.profitVsCeiling >= 0 ? "gain" : "loss"}
            />
            <ComputedField
              label="Unrealized vs Market"
              value={formatMvr(Math.abs(exchange.unrealizedVsMarket))}
              tone={exchange.unrealizedVsMarket >= 0 ? "gain" : "loss"}
            />
            <ComputedField
              label="Realized Profit"
              value={exchange.realizedProfit !== null ? formatMvr(Math.abs(exchange.realizedProfit)) : "Not sold"}
              tone={exchange.realizedProfit !== null && exchange.realizedProfit < 0 ? "loss" : "gain"}
            />
          </div>
        </FormSection>
      )}

      <button
        type="submit"
        className="self-start bg-gold-deep px-8 py-3.5 font-mono text-xs uppercase tracking-[0.2em] text-ink transition-colors hover:bg-gold-deep/90"
      >
        {exchange ? "Save Changes" : "Log Purchase"}
      </button>
    </form>
  );
}
