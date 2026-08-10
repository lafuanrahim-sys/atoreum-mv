import Link from "next/link";
import PageHeader from "@/components/dashboard/PageHeader";
import { createShipmentAction } from "@/app/actions/stock";
import SubmitButton from "@/components/ui/SubmitButton";

export default function NewShipmentPage() {
  return (
    <div className="max-w-2xl">
      <PageHeader
        eyebrow="Inventory"
        title="Log a Shipment"
        description="Record the delivery first, then add what arrived on the next screen."
      />

      <form action={createShipmentAction} className="mt-8 flex flex-col gap-6 border border-line p-6">
        <label className="flex flex-col gap-1.5">
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-ivory-dim">Reference</span>
          <input
            type="text"
            name="reference"
            required
            placeholder="Supplier invoice, AWB, or box number"
            className="border-b border-line bg-transparent px-1 py-2 text-sm text-ivory placeholder:text-ivory-dim/60 focus:border-gold-deep focus:outline-none"
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-ivory-dim">Supplier</span>
          <input
            type="text"
            name="supplier"
            placeholder="Lebelage"
            className="border-b border-line bg-transparent px-1 py-2 text-sm text-ivory placeholder:text-ivory-dim/60 focus:border-gold-deep focus:outline-none"
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-ivory-dim">Shipped date (optional)</span>
          <input
            type="date"
            name="shippedDate"
            className="border-b border-line bg-transparent px-1 py-2 font-mono text-sm text-ivory focus:border-gold-deep focus:outline-none"
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-ivory-dim">Notes (optional)</span>
          <textarea
            name="notes"
            rows={3}
            placeholder="Anything worth remembering about this delivery"
            className="border border-line bg-transparent px-3 py-2 text-sm text-ivory placeholder:text-ivory-dim/60 focus:border-gold-deep focus:outline-none"
          />
        </label>

        <div className="flex items-center gap-5">
          <SubmitButton pendingLabel="Creating…">Create shipment</SubmitButton>
          <Link
            href="/dashboard/shipments"
            className="font-mono text-xs uppercase tracking-[0.12em] text-ivory-dim transition-colors hover:text-ivory"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
