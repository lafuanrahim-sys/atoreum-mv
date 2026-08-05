import { notFound } from "next/navigation";
import { getFxExchange, getFxSettings } from "@/lib/data/fx.server";
import { deleteFxExchangeAction, updateFxExchangeAction } from "@/app/actions/fx";
import FxExchangeForm from "@/components/admin/FxExchangeForm";
import PageHeader from "@/components/dashboard/PageHeader";
import AdminActionButton from "@/components/dashboard/AdminActionButton";

export default async function EditFxExchangePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [exchange, settings] = await Promise.all([getFxExchange(id), getFxSettings()]);
  if (!exchange) notFound();

  const boundAction = updateFxExchangeAction.bind(null, id);

  return (
    <div>
      <PageHeader
        eyebrow="Dollar Exchange"
        title="Edit Purchase"
        description={exchange.counterparty}
        actions={
          <AdminActionButton
            action={async () => {
              "use server";
              await deleteFxExchangeAction(id);
            }}
            label="Delete"
            pendingLabel="Deleting…"
            variant="danger"
            toastMessage="Purchase deleted."
            confirmTitle="Delete this purchase?"
            confirmMessage={`The ${exchange.usdAmount} USD purchase from ${exchange.counterparty} will be permanently removed. This can't be undone.`}
            confirmLabel="Delete"
          />
        }
      />
      <div className="mt-10">
        <FxExchangeForm
          exchange={exchange}
          action={boundAction}
          defaultCeilingRate={settings.ceilingRate}
          defaultMarketRate={settings.latestMarketRate}
        />
      </div>
    </div>
  );
}
