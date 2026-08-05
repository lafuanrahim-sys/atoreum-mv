import { getFxSettings } from "@/lib/data/fx.server";
import { createFxExchangeAction } from "@/app/actions/fx";
import FxExchangeForm from "@/components/admin/FxExchangeForm";
import PageHeader from "@/components/dashboard/PageHeader";

export default async function NewFxExchangePage() {
  const settings = await getFxSettings();
  return (
    <div>
      <PageHeader eyebrow="Dollar Exchange" title="Log a Purchase" />
      <div className="mt-10">
        <FxExchangeForm
          action={createFxExchangeAction}
          defaultCeilingRate={settings.ceilingRate}
          defaultMarketRate={settings.latestMarketRate}
        />
      </div>
    </div>
  );
}
