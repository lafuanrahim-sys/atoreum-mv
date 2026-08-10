"use client";

import { useMemo, useState, useTransition } from "react";
import { useToast } from "@/components/dashboard/ToastProvider";
import { receiveShipmentAction, saveShipmentLinesAction } from "@/app/actions/stock";
import type { Shipment } from "@/lib/data/stock.server";

type ProductOption = { id: string; name: string; sku: string; price: number; currency: string };

type Line = {
  productId: string;
  productName: string;
  sku: string;
  qtyExpected: string;
  qtyReceived: string;
  qtyFaulty: string;
  note: string;
  /** From the products table, not stored on the line -- see ShipmentItem.unitPrice. */
  unitPrice: number;
  currency: string;
};

/**
 * Line entry for a shipment: what was expected, what actually turned up, and
 * how many of those were faulty. Only good units (received minus faulty)
 * ever become sellable stock, which is why faulty is captured here at the
 * point of unpacking rather than as a later write-off -- a damaged unit is
 * never briefly sellable.
 *
 * Editing is disabled entirely once received, because at that point the
 * quantities have already been posted to the stock movement ledger and
 * changing them would silently desync stock_on_hand from its own history.
 */
export default function ShipmentLinesForm({
  shipment,
  products,
}: {
  shipment: Shipment;
  products: ProductOption[];
}) {
  const locked = shipment.status === "received";
  const [lines, setLines] = useState<Line[]>(
    shipment.items.map((i) => ({
      productId: i.productId,
      productName: i.productName,
      sku: i.sku,
      qtyExpected: String(i.qtyExpected),
      qtyReceived: String(i.qtyReceived),
      qtyFaulty: String(i.qtyFaulty),
      note: i.note,
      unitPrice: i.unitPrice,
      currency: i.currency,
    }))
  );
  const [picker, setPicker] = useState("");
  const [isPending, startTransition] = useTransition();
  const { showToast } = useToast();

  const chosen = useMemo(() => new Set(lines.map((l) => l.productId)), [lines]);
  const matches = useMemo(() => {
    const q = picker.trim().toLowerCase();
    if (!q) return [];
    return products
      .filter((p) => !chosen.has(p.id))
      .filter((p) => p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q))
      .slice(0, 6);
  }, [picker, products, chosen]);

  const num = (v: string) => Math.max(0, Math.floor(Number(v) || 0));
  const totals = lines.reduce(
    (acc, l) => {
      const received = num(l.qtyReceived);
      const faulty = Math.min(num(l.qtyFaulty), received);
      acc.expected += num(l.qtyExpected);
      acc.received += received;
      acc.faulty += faulty;
      acc.good += received - faulty;
      acc.value += (received - faulty) * l.unitPrice;
      return acc;
    },
    { expected: 0, received: 0, faulty: 0, good: 0, value: 0 }
  );
  const currency = lines[0]?.currency ?? "MVR";

  const badLine = lines.find((l) => num(l.qtyFaulty) > num(l.qtyReceived));

  const addProduct = (p: ProductOption) => {
    setLines((prev) => [
      ...prev,
      {
        productId: p.id,
        productName: p.name,
        sku: p.sku,
        qtyExpected: "",
        qtyReceived: "",
        qtyFaulty: "",
        note: "",
        unitPrice: p.price,
        currency: p.currency,
      },
    ]);
    setPicker("");
  };

  const update = (productId: string, field: keyof Line, value: string) =>
    setLines((prev) => prev.map((l) => (l.productId === productId ? { ...l, [field]: value } : l)));

  const save = () =>
    startTransition(async () => {
      try {
        await saveShipmentLinesAction(
          shipment.id,
          lines.map((l) => ({
            productId: l.productId,
            qtyExpected: num(l.qtyExpected),
            qtyReceived: num(l.qtyReceived),
            qtyFaulty: num(l.qtyFaulty),
            note: l.note,
          }))
        );
        showToast("Lines saved.", "success");
      } catch (err) {
        showToast(err instanceof Error ? err.message : "Couldn't save the lines.", "error");
      }
    });

  const receive = () =>
    startTransition(async () => {
      try {
        await saveShipmentLinesAction(
          shipment.id,
          lines.map((l) => ({
            productId: l.productId,
            qtyExpected: num(l.qtyExpected),
            qtyReceived: num(l.qtyReceived),
            qtyFaulty: num(l.qtyFaulty),
            note: l.note,
          }))
        );
        const res = await receiveShipmentAction(shipment.id);
        showToast(
          `Received. ${res.unitsAdded} unit(s) added to stock${res.faulty > 0 ? `, ${res.faulty} faulty set aside` : ""}.`,
          "success"
        );
      } catch (err) {
        showToast(err instanceof Error ? err.message : "Couldn't receive the shipment.", "error");
      }
    });

  return (
    <div>
      {!locked && (
        <div className="relative mb-6">
          <input
            type="text"
            value={picker}
            onChange={(e) => setPicker(e.target.value)}
            placeholder="Add a product by name or SKU…"
            className="w-full border-b border-line bg-transparent px-1 py-2 text-sm text-ivory placeholder:text-ivory-dim/60 focus:border-gold-deep focus:outline-none"
          />
          {picker.trim() && (
            <ul className="absolute z-20 mt-1 w-full border border-line bg-ink shadow-[0_18px_40px_-24px_rgba(0,0,0,0.9)]">
              {matches.length === 0 ? (
                <li className="px-4 py-3 text-sm text-ivory-dim">No product matches “{picker.trim()}”.</li>
              ) : (
                matches.map((p) => (
                  <li key={p.id}>
                    <button
                      type="button"
                      onClick={() => addProduct(p)}
                      className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-ink-2"
                    >
                      <span className="truncate text-sm text-ivory">{p.name}</span>
                      <span className="shrink-0 font-mono text-xs text-ivory-dim">{p.sku}</span>
                    </button>
                  </li>
                ))
              )}
            </ul>
          )}
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b-2 border-ivory text-left">
              <th className="pb-2 pr-4 font-mono text-[10px] font-normal uppercase tracking-[0.2em] text-ivory-dim">Product</th>
              <th className="pb-2 pr-4 text-right font-mono text-[10px] font-normal uppercase tracking-[0.2em] text-ivory-dim">Expected</th>
              <th className="pb-2 pr-4 text-right font-mono text-[10px] font-normal uppercase tracking-[0.2em] text-ivory-dim">Received</th>
              <th className="pb-2 pr-4 text-right font-mono text-[10px] font-normal uppercase tracking-[0.2em] text-ivory-dim">Faulty</th>
              <th className="pb-2 pr-4 text-right font-mono text-[10px] font-normal uppercase tracking-[0.2em] text-ivory-dim">Into stock</th>
              <th className="pb-2 pr-4 text-right font-mono text-[10px] font-normal uppercase tracking-[0.2em] text-ivory-dim">Unit price</th>
              <th className="pb-2 pr-4 text-right font-mono text-[10px] font-normal uppercase tracking-[0.2em] text-ivory-dim">Value</th>
              <th className="pb-2 pr-4 font-mono text-[10px] font-normal uppercase tracking-[0.2em] text-ivory-dim">Note</th>
              {!locked && <th className="pb-2" />}
            </tr>
          </thead>
          <tbody>
            {lines.map((l) => {
              const received = num(l.qtyReceived);
              const faulty = num(l.qtyFaulty);
              const over = faulty > received;
              const good = Math.max(0, received - Math.min(faulty, received));
              return (
                <tr key={l.productId} className="border-b border-line last:border-b-0">
                  <td className="py-2.5 pr-4">
                    <p className="text-ivory">{l.productName}</p>
                    <p className="font-mono text-[11px] text-ivory-dim">{l.sku}</p>
                  </td>
                  <td className="py-2.5 pr-4 text-right">
                    <NumCell value={l.qtyExpected} locked={locked} label={`Expected for ${l.productName}`} onChange={(v) => update(l.productId, "qtyExpected", v)} />
                  </td>
                  <td className="py-2.5 pr-4 text-right">
                    <NumCell value={l.qtyReceived} locked={locked} label={`Received for ${l.productName}`} onChange={(v) => update(l.productId, "qtyReceived", v)} />
                  </td>
                  <td className="py-2.5 pr-4 text-right">
                    <NumCell
                      value={l.qtyFaulty}
                      locked={locked}
                      tone={over ? "error" : faulty > 0 ? "warn" : "default"}
                      label={`Faulty for ${l.productName}`}
                      onChange={(v) => update(l.productId, "qtyFaulty", v)}
                    />
                  </td>
                  <td className="py-2.5 pr-4 text-right font-mono tabular-nums text-gold-deep">{good}</td>
                  <td className="py-2.5 pr-4 text-right font-mono tabular-nums text-ivory-dim">
                    {l.unitPrice.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className="py-2.5 pr-4 text-right font-mono tabular-nums text-ivory">
                    {(good * l.unitPrice).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className="py-2.5 pr-4">
                    {locked ? (
                      <span className="text-xs text-ivory-dim">{l.note || "—"}</span>
                    ) : (
                      <input
                        type="text"
                        value={l.note}
                        onChange={(e) => update(l.productId, "note", e.target.value)}
                        placeholder="Crushed box, leaking cap…"
                        aria-label={`Note for ${l.productName}`}
                        className="w-full border-b border-line bg-transparent px-1 py-1 text-xs text-ivory placeholder:text-ivory-dim/40 focus:border-gold-deep focus:outline-none"
                      />
                    )}
                  </td>
                  {!locked && (
                    <td className="py-2.5 text-right">
                      <button
                        type="button"
                        onClick={() => setLines((prev) => prev.filter((x) => x.productId !== l.productId))}
                        className="font-mono text-[10px] uppercase tracking-[0.15em] text-ivory-dim transition-colors hover:text-red-400"
                      >
                        Remove
                      </button>
                    </td>
                  )}
                </tr>
              );
            })}
            {lines.length === 0 && (
              <tr>
                <td colSpan={locked ? 8 : 9} className="py-6 text-sm text-ivory-dim">
                  No lines yet. Add the products that arrived in this shipment.
                </td>
              </tr>
            )}
          </tbody>
          {lines.length > 0 && (
            <tfoot>
              <tr className="border-t-2 border-ivory">
                <td className="py-3 pr-4 font-mono text-[10px] uppercase tracking-[0.2em] text-ivory-dim">Total</td>
                <td className="py-3 pr-4 text-right font-mono tabular-nums text-ivory-dim">{totals.expected}</td>
                <td className="py-3 pr-4 text-right font-mono tabular-nums text-ivory">{totals.received}</td>
                <td className={`py-3 pr-4 text-right font-mono tabular-nums ${totals.faulty > 0 ? "text-red-400" : "text-ivory-dim"}`}>
                  {totals.faulty}
                </td>
                <td className="py-3 pr-4 text-right font-mono tabular-nums text-gold-deep">{totals.good}</td>
                <td className="py-3 pr-4" />
                <td className="py-3 pr-4 text-right font-mono tabular-nums text-ivory">
                  {currency} {totals.value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </td>
                <td className="py-3" />
                {!locked && <td className="py-3" />}
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {badLine && (
        <p className="mt-4 text-sm text-red-400">
          {badLine.productName}: faulty units can&apos;t be more than the number received.
        </p>
      )}

      {locked ? (
        <p className="mt-6 text-sm text-ivory-dim">
          This shipment was received{shipment.receivedDate ? ` on ${shipment.receivedDate}` : ""} and its{" "}
          {shipment.totalGood} good unit(s) are already in stock. Lines are locked so the stock history stays accurate.
          Correct a mistake with a stock count instead.
        </p>
      ) : (
        <div className="mt-6 flex flex-wrap items-center gap-4">
          <button
            type="button"
            onClick={save}
            disabled={isPending || Boolean(badLine)}
            className="border border-line px-5 py-2.5 font-mono text-xs uppercase tracking-[0.15em] text-ivory-dim transition-colors hover:border-gold-deep hover:text-gold-deep disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isPending ? "Saving…" : "Save draft"}
          </button>
          <button
            type="button"
            onClick={receive}
            disabled={isPending || Boolean(badLine) || lines.length === 0 || totals.good === 0}
            className="bg-gold-deep px-5 py-2.5 font-mono text-xs uppercase tracking-[0.15em] text-ink transition-colors hover:bg-gold-deep/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isPending ? "Receiving…" : `Receive ${totals.good} unit(s) into stock`}
          </button>
          <span className="text-xs text-ivory-dim">Receiving is final and adds the good units to stock.</span>
        </div>
      )}
    </div>
  );
}

function NumCell({
  value,
  onChange,
  locked,
  label,
  tone = "default",
}: {
  value: string;
  onChange: (v: string) => void;
  locked: boolean;
  label: string;
  tone?: "default" | "warn" | "error";
}) {
  if (locked) {
    return <span className="font-mono tabular-nums text-ivory-dim">{value || 0}</span>;
  }
  const toneClass = tone === "error" ? "text-red-400" : tone === "warn" ? "text-red-400" : "text-ivory";
  return (
    <input
      type="number"
      min={0}
      step={1}
      inputMode="numeric"
      value={value}
      aria-label={label}
      onChange={(e) => onChange(e.target.value)}
      placeholder="0"
      className={`w-20 border-b border-line bg-transparent px-1 py-1 text-right font-mono text-sm tabular-nums placeholder:text-ivory-dim/40 focus:border-gold-deep focus:outline-none ${toneClass}`}
    />
  );
}
