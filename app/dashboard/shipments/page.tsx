import Link from "next/link";
import PageHeader from "@/components/dashboard/PageHeader";
import { listShipments, getFaultySummary } from "@/lib/data/stock.server";

function formatDate(value: string | null) {
  return value ? value : "Not set";
}

export default async function ShipmentsPage() {
  const [shipments, faulty] = await Promise.all([listShipments(), getFaultySummary()]);

  const received = shipments.filter((s) => s.status === "received");
  const totalFaulty = received.reduce((sum, s) => sum + s.totalFaulty, 0);
  const totalReceived = received.reduce((sum, s) => sum + s.totalReceived, 0);
  const faultyRate = totalReceived > 0 ? (totalFaulty / totalReceived) * 100 : 0;

  return (
    <div>
      <PageHeader
        eyebrow="Inventory"
        title="Shipments"
        count={shipments.length}
        description="Every delivery in, what actually arrived, and how much of it was faulty. Receiving a shipment adds its good units to stock."
        actions={
          <>
            <Link
              href="/dashboard/shipments/new"
              className="bg-gold-deep px-5 py-2.5 text-xs uppercase tracking-[0.15em] text-ink transition-colors hover:bg-gold-deep/90"
            >
              + Log a Shipment
            </Link>
            <Link
              href="/dashboard/stock"
              className="border border-line px-5 py-2.5 text-xs uppercase tracking-[0.15em] text-ivory-dim transition-colors hover:border-gold-deep hover:text-gold-deep"
            >
              Stock Count →
            </Link>
          </>
        }
      />

      <div className="mt-8 grid grid-cols-2 gap-x-8 gap-y-8 border-b border-line pb-8 sm:grid-cols-4">
        <Stat label="Units received" value={totalReceived.toLocaleString()} />
        <Stat label="Faulty units" value={totalFaulty.toLocaleString()} tone={totalFaulty > 0 ? "loss" : "default"} />
        <Stat label="Faulty rate" value={`${faultyRate.toFixed(1)}%`} tone={faultyRate > 5 ? "loss" : "default"} />
        <Stat label="Awaiting receipt" value={String(shipments.filter((s) => s.status === "draft").length)} />
      </div>

      <div className="mt-8 overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b-2 border-ivory text-left">
              <th className="pb-2 pr-4 font-mono text-[10px] font-normal uppercase tracking-[0.2em] text-ivory-dim">Reference</th>
              <th className="pb-2 pr-4 font-mono text-[10px] font-normal uppercase tracking-[0.2em] text-ivory-dim">Supplier</th>
              <th className="pb-2 pr-4 font-mono text-[10px] font-normal uppercase tracking-[0.2em] text-ivory-dim">Shipped</th>
              <th className="pb-2 pr-4 font-mono text-[10px] font-normal uppercase tracking-[0.2em] text-ivory-dim">Received</th>
              <th className="pb-2 pr-4 text-right font-mono text-[10px] font-normal uppercase tracking-[0.2em] text-ivory-dim">Expected</th>
              <th className="pb-2 pr-4 text-right font-mono text-[10px] font-normal uppercase tracking-[0.2em] text-ivory-dim">Received</th>
              <th className="pb-2 pr-4 text-right font-mono text-[10px] font-normal uppercase tracking-[0.2em] text-ivory-dim">Faulty</th>
              <th className="pb-2 pr-4 text-right font-mono text-[10px] font-normal uppercase tracking-[0.2em] text-ivory-dim">Into stock</th>
              <th className="pb-2 text-right font-mono text-[10px] font-normal uppercase tracking-[0.2em] text-ivory-dim">Status</th>
            </tr>
          </thead>
          <tbody>
            {shipments.map((s) => (
              <tr key={s.id} className="border-b border-line last:border-b-0">
                <td className="py-3 pr-4">
                  <Link href={`/dashboard/shipments/${s.id}`} className="text-ivory transition-colors hover:text-gold-deep">
                    {s.reference || "Untitled shipment"}
                  </Link>
                </td>
                <td className="py-3 pr-4 text-ivory-dim">{s.supplier || "—"}</td>
                <td className="py-3 pr-4 font-mono text-xs text-ivory-dim">{formatDate(s.shippedDate)}</td>
                <td className="py-3 pr-4 font-mono text-xs text-ivory-dim">{formatDate(s.receivedDate)}</td>
                <td className="py-3 pr-4 text-right font-mono tabular-nums text-ivory-dim">{s.totalExpected}</td>
                <td className="py-3 pr-4 text-right font-mono tabular-nums text-ivory">{s.totalReceived}</td>
                <td
                  className={`py-3 pr-4 text-right font-mono tabular-nums ${s.totalFaulty > 0 ? "text-red-400" : "text-ivory-dim"}`}
                >
                  {s.totalFaulty}
                </td>
                <td className="py-3 pr-4 text-right font-mono tabular-nums text-gold-deep">{s.totalGood}</td>
                <td className="py-3 text-right font-mono text-[10px] uppercase tracking-[0.15em] text-ivory-dim">
                  {s.status === "received" ? "Received" : "Draft"}
                </td>
              </tr>
            ))}
            {shipments.length === 0 && (
              <tr>
                <td colSpan={9} className="py-6 text-sm text-ivory-dim">
                  No shipments logged yet. Log the first one above.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <h2 className="mt-14 font-mono text-[10px] uppercase tracking-[0.2em] text-ivory-dim">Faulty by Product</h2>
      <p className="mt-2 text-sm text-ivory-dim">
        Across every received shipment. Use this to see what keeps arriving damaged and what to raise with the supplier.
      </p>
      {faulty.length === 0 ? (
        <p className="mt-4 text-sm text-ivory-dim">Nothing faulty recorded yet.</p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-line text-left">
                <th className="pb-2 pr-4 font-mono text-[10px] font-normal uppercase tracking-[0.2em] text-ivory-dim">Product</th>
                <th className="pb-2 pr-4 font-mono text-[10px] font-normal uppercase tracking-[0.2em] text-ivory-dim">SKU</th>
                <th className="pb-2 pr-4 text-right font-mono text-[10px] font-normal uppercase tracking-[0.2em] text-ivory-dim">Faulty</th>
                <th className="pb-2 pr-4 text-right font-mono text-[10px] font-normal uppercase tracking-[0.2em] text-ivory-dim">Received</th>
                <th className="pb-2 text-right font-mono text-[10px] font-normal uppercase tracking-[0.2em] text-ivory-dim">Rate</th>
              </tr>
            </thead>
            <tbody>
              {faulty.map((f) => (
                <tr key={f.productId} className="border-b border-line/60 last:border-b-0">
                  <td className="py-3 pr-4 text-ivory">{f.productName}</td>
                  <td className="py-3 pr-4 font-mono text-xs text-ivory-dim">{f.sku}</td>
                  <td className="py-3 pr-4 text-right font-mono tabular-nums text-red-400">{f.faulty}</td>
                  <td className="py-3 pr-4 text-right font-mono tabular-nums text-ivory-dim">{f.received}</td>
                  <td className="py-3 text-right font-mono tabular-nums text-ivory-dim">{f.faultyRate.toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, tone = "default" }: { label: string; value: string; tone?: "default" | "loss" }) {
  return (
    <div>
      <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ivory-dim">{label}</p>
      <p className={`mt-2 font-mono text-2xl font-medium tabular-nums ${tone === "loss" ? "text-red-400" : "text-ivory"}`}>
        {value}
      </p>
    </div>
  );
}
