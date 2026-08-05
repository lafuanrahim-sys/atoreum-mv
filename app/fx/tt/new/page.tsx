import { getFxSettings } from "@/lib/data/fx.server";
import { createFxTtAction } from "@/app/actions/fx";
import FxTtForm from "@/components/admin/FxTtForm";
import PageHeader from "@/components/dashboard/PageHeader";

export default async function NewFxTtPage() {
  const settings = await getFxSettings();
  return (
    <div>
      <PageHeader eyebrow="Dollar Exchange" title="Log a TT" />
      <div className="mt-10">
        <FxTtForm action={createFxTtAction} defaultBankRate={settings.bankTtRate} defaultMarketRate={settings.latestMarketRate} />
      </div>
    </div>
  );
}
