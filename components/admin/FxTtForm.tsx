"use client";

import type { FxTtPayment } from "@/lib/types";
import { formatMvr, formatUsd } from "@/lib/fxFormat";
import { ComputedField, FormSection, TextArea, TextField } from "@/components/admin/AdminFormFields";

/**
 * Shared create/edit form for a TT paid with partial Bank of Maldives
 * dollar support. The parent page binds `action` to either
 * createFxTtAction or updateFxTtAction (bound with the row id).
 */
export default function FxTtForm({
  payment,
  action,
  defaultBankRate,
  defaultMarketRate,
}: {
  payment?: FxTtPayment;
  action: (formData: FormData) => void | Promise<void>;
  defaultBankRate: number;
  defaultMarketRate: number;
}) {
  const today = new Date().toISOString().slice(0, 10);
  // Stored as a fraction (0.499853); the form works in percentage (49.9853) for readability.
  const supportPctDisplay = payment ? Number((payment.supportPct * 100).toFixed(6)) : undefined;

  return (
    <form action={action} className="flex max-w-2xl flex-col gap-10">
      <FormSection eyebrow="01" title="The Transfer">
        <div className="grid grid-cols-2 gap-5">
          <TextField label="Date" name="ttDate" type="date" defaultValue={payment?.ttDate ?? today} required />
          <TextField label="Reference" name="reference" defaultValue={payment?.reference} required />
        </div>
        <TextField label="Purpose" name="purpose" defaultValue={payment?.purpose} />
        <div className="grid grid-cols-2 gap-5">
          <TextField label="TT Amount (USD)" name="ttAmount" type="number" step="0.01" defaultValue={payment?.ttAmount} required />
          <TextField
            label="Bank Support Share (%)"
            name="supportPct"
            type="number"
            step="0.0001"
            defaultValue={supportPctDisplay}
            hint="The share of the TT the bank supplies at its own rate — the rest comes from the company's own USD account."
            required
          />
        </div>
        <div className="grid grid-cols-2 gap-5">
          <TextField
            label="Bank Rate"
            name="bankRate"
            type="number"
            step="0.01"
            defaultValue={payment?.bankRate ?? defaultBankRate}
            required
          />
          <TextField
            label="Today's Market Rate"
            name="marketRate"
            type="number"
            step="0.01"
            defaultValue={payment?.marketRate ?? defaultMarketRate}
            required
          />
        </div>
        <TextArea label="Notes" name="notes" defaultValue={payment?.notes} rows={2} />
      </FormSection>

      {payment && (
        <FormSection eyebrow="02" title="Calculated">
          <div className="grid grid-cols-2 gap-5 sm:grid-cols-3">
            <ComputedField label="USD via Bank" value={formatUsd(payment.usdViaBank)} />
            <ComputedField label="USD from Own Account" value={formatUsd(payment.usdFromOwn)} />
            <ComputedField label="Cash Paid" value={formatMvr(payment.cashPaidMvr)} />
            <ComputedField label="Own USD at Bank Rate" value={formatMvr(payment.ownUsdAtBankRate)} />
            <ComputedField label="Cost of Own USD" value={formatMvr(payment.costOwnUsdMvr)} />
            <ComputedField label="Opportunity Cost" value={formatMvr(payment.opportunityCost)} tone="loss" />
            <ComputedField label="Total Effective Cost" value={formatMvr(payment.totalEffectiveCost)} />
            <ComputedField label="Cost With No Support" value={formatMvr(payment.costNoSupport)} />
            <ComputedField label="Cash Saved Today" value={formatMvr(payment.cashSavedToday)} tone="gain" />
            <ComputedField label="Saved incl. Opportunity Cost" value={formatMvr(payment.totalSavedInclOpp)} tone="gain" />
          </div>
        </FormSection>
      )}

      <button
        type="submit"
        className="self-start bg-gold-deep px-8 py-3.5 font-mono text-xs uppercase tracking-[0.2em] text-ink transition-colors hover:bg-gold-deep/90"
      >
        {payment ? "Save Changes" : "Log TT"}
      </button>
    </form>
  );
}
