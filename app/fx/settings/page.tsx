import { getFxSettings } from "@/lib/data/fx.server";
import { updateFxSettingsAction } from "@/app/actions/fx";
import PageHeader from "@/components/dashboard/PageHeader";

export default async function FxSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string }>;
}) {
  const { saved } = await searchParams;
  const settings = await getFxSettings();

  return (
    <div className="max-w-xl">
      <PageHeader
        eyebrow="Dollar Exchange"
        title="Rates & Settings"
        description="New purchases and TTs pre-fill from these three rates. Editing them doesn't change rows already logged."
      />

      <form action={updateFxSettingsAction} className="mt-10 flex flex-col gap-6">
        <label className="flex flex-col gap-1.5">
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-ivory-dim">Ceiling Rate</span>
          <input
            type="number"
            name="ceilingRate"
            step="0.01"
            defaultValue={settings.ceilingRate}
            required
            className="border-b border-line bg-transparent px-1 py-2 font-mono text-sm text-ivory focus:border-gold-deep focus:outline-none"
          />
          <span className="text-[11px] text-ivory-dim/80">The rate the store won&apos;t buy above.</span>
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-ivory-dim">Bank TT Rate</span>
          <input
            type="number"
            name="bankTtRate"
            step="0.01"
            defaultValue={settings.bankTtRate}
            required
            className="border-b border-line bg-transparent px-1 py-2 font-mono text-sm text-ivory focus:border-gold-deep focus:outline-none"
          />
          <span className="text-[11px] text-ivory-dim/80">Bank of Maldives&apos; own rate for the dollar-support share of a TT.</span>
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-ivory-dim">Latest Market Rate</span>
          <input
            type="number"
            name="latestMarketRate"
            step="0.01"
            defaultValue={settings.latestMarketRate}
            required
            className="border-b border-line bg-transparent px-1 py-2 font-mono text-sm text-ivory focus:border-gold-deep focus:outline-none"
          />
          <span className="text-[11px] text-ivory-dim/80">Today&apos;s parallel-market rate. Update this each time it moves.</span>
        </label>

        {saved === "1" && (
          <p className="font-mono text-xs uppercase tracking-[0.1em] text-gold-deep" role="status">
            Settings saved.
          </p>
        )}

        <button
          type="submit"
          className="self-start bg-gold-deep px-6 py-3 font-mono text-xs uppercase tracking-[0.15em] text-ink transition-colors hover:bg-gold-deep/90"
        >
          Save Settings
        </button>
      </form>

      <p className="mt-10 border-t border-line pt-6 text-xs text-ivory-dim">
        Last updated {new Date(settings.updatedAt).toLocaleString()}
        {settings.updatedBy ? ` by ${settings.updatedBy}` : ""}.
      </p>
    </div>
  );
}
