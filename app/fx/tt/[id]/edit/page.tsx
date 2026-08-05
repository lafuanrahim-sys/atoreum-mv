import { notFound } from "next/navigation";
import { getFxSettings, getFxTtPayment } from "@/lib/data/fx.server";
import { deleteFxTtAction, updateFxTtAction } from "@/app/actions/fx";
import FxTtForm from "@/components/admin/FxTtForm";
import PageHeader from "@/components/dashboard/PageHeader";
import AdminActionButton from "@/components/dashboard/AdminActionButton";

export default async function EditFxTtPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [payment, settings] = await Promise.all([getFxTtPayment(id), getFxSettings()]);
  if (!payment) notFound();

  const boundAction = updateFxTtAction.bind(null, id);

  return (
    <div>
      <PageHeader
        eyebrow="Dollar Exchange"
        title="Edit TT"
        description={payment.reference}
        actions={
          <AdminActionButton
            action={async () => {
              "use server";
              await deleteFxTtAction(id);
            }}
            label="Delete"
            pendingLabel="Deleting…"
            variant="danger"
            toastMessage="TT deleted."
            confirmTitle="Delete this TT?"
            confirmMessage={`The TT for ${payment.reference} will be permanently removed. This can't be undone.`}
            confirmLabel="Delete"
          />
        }
      />
      <div className="mt-10">
        <FxTtForm payment={payment} action={boundAction} defaultBankRate={settings.bankTtRate} defaultMarketRate={settings.latestMarketRate} />
      </div>
    </div>
  );
}
