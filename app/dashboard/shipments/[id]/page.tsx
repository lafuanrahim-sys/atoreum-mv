import Link from "next/link";
import { notFound } from "next/navigation";
import PageHeader from "@/components/dashboard/PageHeader";
import AdminActionButton from "@/components/dashboard/AdminActionButton";
import ShipmentLinesForm from "@/components/dashboard/ShipmentLinesForm";
import ShipmentAttachments, { type AttachmentView } from "@/components/dashboard/ShipmentAttachments";
import { getShipment } from "@/lib/data/stock.server";
import { getAllProducts } from "@/lib/data/products.server";
import { deleteShipmentAction } from "@/app/actions/stock";
import { SHIPMENT_FILES_BUCKET, createSignedDownloadUrl } from "@/lib/storage";

export default async function ShipmentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [shipment, products] = await Promise.all([getShipment(id), getAllProducts()]);
  if (!shipment) notFound();

  // Signed per render, never persisted -- a link copied out of the page
  // stops working shortly after (see lib/storage.ts).
  const attachments: AttachmentView[] = await Promise.all(
    shipment.files.map(async (f) => ({
      id: f.id,
      fileName: f.fileName,
      contentType: f.contentType,
      sizeBytes: f.sizeBytes,
      uploadedBy: f.uploadedBy,
      createdAt: f.createdAt,
      downloadUrl: await createSignedDownloadUrl(SHIPMENT_FILES_BUCKET, f.storagePath),
    }))
  );

  return (
    <div>
      <PageHeader
        eyebrow="Inventory"
        title={shipment.reference || "Shipment"}
        description={
          shipment.status === "received"
            ? "Received. These quantities are already reflected in stock."
            : "Draft. Add what arrived, then receive it to add the good units to stock."
        }
        actions={
          <>
            <Link
              href="/dashboard/shipments"
              className="border border-line px-5 py-2.5 text-xs uppercase tracking-[0.15em] text-ivory-dim transition-colors hover:border-gold-deep hover:text-gold-deep"
            >
              ← All shipments
            </Link>
            {shipment.status === "draft" && (
              <AdminActionButton
                action={async () => {
                  "use server";
                  await deleteShipmentAction(shipment.id);
                }}
                label="Delete draft"
                pendingLabel="Deleting…"
                variant="danger"
                confirmMessage="Delete this draft shipment? Nothing has been added to stock yet."
              />
            )}
          </>
        }
      />

      <dl className="mt-8 grid grid-cols-2 gap-x-8 gap-y-6 border-b border-line pb-8 sm:grid-cols-4">
        <Field label="Supplier" value={shipment.supplier || "Not set"} />
        <Field label="Shipped" value={shipment.shippedDate ?? "Not set"} />
        <Field label="Received" value={shipment.receivedDate ?? "Not yet"} />
        <Field label="Logged by" value={shipment.createdBy ?? "Unknown"} />
      </dl>

      {shipment.notes && <p className="mt-6 max-w-2xl text-sm leading-relaxed text-ivory-dim">{shipment.notes}</p>}

      <div className="mt-10">
        {/* Keyed on the current line set so that a sheet import (which writes
            lines server-side, then revalidates) remounts this form with the
            new rows -- its editable state is seeded from props in useState,
            which a re-render alone would not refresh. */}
        <ShipmentLinesForm
          key={shipment.items.map((i) => `${i.productId}:${i.qtyExpected}:${i.qtyReceived}:${i.qtyFaulty}`).join("|")}
          shipment={shipment}
          products={products.map((p) => ({
            id: p.id,
            name: p.name,
            sku: p.sku,
            price: p.price,
            currency: p.currency,
          }))}
        />
      </div>

      <div className="mt-12">
        <ShipmentAttachments shipmentId={shipment.id} files={attachments} />
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="font-mono text-[10px] uppercase tracking-[0.2em] text-ivory-dim">{label}</dt>
      <dd className="mt-2 text-sm text-ivory">{value}</dd>
    </div>
  );
}
