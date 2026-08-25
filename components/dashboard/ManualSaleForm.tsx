"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createManualSaleAction } from "@/app/actions/manualSale";
import { ORDER_CHANNELS } from "@/lib/data/orderChannels";

/**
 * Entering a sale that came in some other way.
 *
 * The form sends product ids and quantities, and nothing about money. Prices,
 * the subtotal and any discount are all resolved on the server from the
 * catalogue — the totals shown here are a preview for whoever is typing, not
 * the figures the order is built from. That distinction matters: a price typed
 * into a form would end up on a tax invoice.
 */

type Product = {
  id: string;
  name: string;
  size: string;
  category: string;
  priceEffective: number;
  currency: string;
  stockStatus: string;
  stockOnHand: number;
};

type Line = { productId: string; quantity: number };

export default function ManualSaleForm({ products }: { products: Product[] }) {
  const router = useRouter();
  const [lines, setLines] = useState<Line[]>([]);
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const byId = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);

  const matches = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return [];
    return products
      .filter((p) => p.name.toLowerCase().includes(q) || p.id.toLowerCase().includes(q))
      .slice(0, 6);
  }, [products, search]);

  const subtotal = lines.reduce((sum, l) => sum + (byId.get(l.productId)?.priceEffective ?? 0) * l.quantity, 0);

  const addLine = (productId: string) => {
    setSearch("");
    setError(null);
    setLines((prev) => {
      const existing = prev.find((l) => l.productId === productId);
      return existing
        ? prev.map((l) => (l.productId === productId ? { ...l, quantity: l.quantity + 1 } : l))
        : [...prev, { productId, quantity: 1 }];
    });
  };

  const setQuantity = (productId: string, quantity: number) =>
    setLines((prev) =>
      quantity <= 0
        ? prev.filter((l) => l.productId !== productId)
        : prev.map((l) => (l.productId === productId ? { ...l, quantity } : l))
    );

  return (
    <form
      action={(formData) => {
        setError(null);
        formData.set("lines", JSON.stringify(lines));
        startTransition(async () => {
          const result = await createManualSaleAction(formData);
          if (result.ok) router.push(`/dashboard/orders/${result.orderId}`);
          else setError(result.error);
        });
      }}
      className="mt-8 flex flex-col gap-10"
    >
      {/* ---- what they bought ---- */}
      <section>
        <h2 className="font-mono text-[11px] uppercase tracking-[0.2em] text-gold">Products</h2>

        <div className="relative mt-3">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or id, then click to add"
            aria-label="Search products to add"
            className="min-h-11 w-full rounded-md border border-line bg-transparent px-4 py-2.5 text-sm text-ivory placeholder:text-ivory-dim focus:border-gold focus:outline-none"
          />
          {matches.length > 0 && (
            <ul className="absolute z-10 mt-1 w-full overflow-hidden rounded-md border border-line bg-ink-2 shadow-xl">
              {matches.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => addLine(p.id)}
                    className="flex w-full items-baseline justify-between gap-4 px-4 py-3 text-left text-sm transition-colors hover:bg-ivory/[0.05]"
                  >
                    <span className="min-w-0 truncate text-ivory">
                      {p.name} <span className="text-ivory-dim">{p.size}</span>
                    </span>
                    <span className="shrink-0 font-mono text-[11px] text-ivory-dim tabular-nums">
                      MVR {p.priceEffective}
                      {p.stockStatus === "out-of-stock" && <span className="ml-2 text-red-400">out of stock</span>}
                      {p.stockStatus === "low-stock" && <span className="ml-2 text-gold">{p.stockOnHand} left</span>}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {lines.length === 0 ? (
          <p className="mt-4 text-sm text-ivory-dim">Nothing added yet.</p>
        ) : (
          <ul className="mt-4 divide-y divide-line border-y border-line">
            {lines.map((l) => {
              const p = byId.get(l.productId);
              if (!p) return null;
              return (
                <li key={l.productId} className="flex items-center gap-4 py-3">
                  <span className="min-w-0 flex-1 truncate text-sm text-ivory">
                    {p.name} <span className="text-ivory-dim">{p.size}</span>
                  </span>
                  <input
                    type="number"
                    min={1}
                    max={999}
                    value={l.quantity}
                    onChange={(e) => setQuantity(l.productId, Number(e.target.value))}
                    aria-label={`Quantity of ${p.name}`}
                    className="h-11 w-16 rounded-md border border-line bg-transparent px-2 text-center text-sm text-ivory tabular-nums focus:border-gold focus:outline-none"
                  />
                  <span className="w-24 shrink-0 text-right font-mono text-[11px] text-ivory-dim tabular-nums">
                    MVR {p.priceEffective * l.quantity}
                  </span>
                  <button
                    type="button"
                    onClick={() => setQuantity(l.productId, 0)}
                    aria-label={`Remove ${p.name}`}
                    className="flex h-11 w-11 items-center justify-center rounded-full text-ivory-dim transition-colors hover:bg-ivory/10 hover:text-ivory"
                  >
                    <svg viewBox="0 0 20 20" className="h-4 w-4" aria-hidden="true">
                      <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        {lines.length > 0 && (
          <p className="mt-4 text-right font-mono text-sm text-ivory tabular-nums">
            Subtotal MVR {subtotal.toLocaleString("en-US")}
            {/* Said out loud, because the number above is a preview and the
                server recalculates it from the catalogue. */}
            <span className="ml-3 text-[10px] uppercase tracking-[0.15em] text-ivory-dim">
              GST included
            </span>
          </p>
        )}
      </section>

      {/* ---- where it came from ---- */}
      <section>
        <h2 className="font-mono text-[11px] uppercase tracking-[0.2em] text-gold">Where it came from</h2>
        <p className="mt-1.5 text-[12px] text-ivory-dim">
          Recorded on the order, so you can see later what each channel actually brings in.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {ORDER_CHANNELS.map((c, i) => (
            <label
              key={c.value}
              className="channel-chip relative cursor-pointer"
            >
              <input
                type="radio"
                name="channel"
                value={c.value}
                defaultChecked={i === 0}
                required
                className="peer sr-only"
              />
              <span className="flex min-h-11 items-center rounded-full border border-line px-5 text-sm text-ivory-dim transition-colors hover:border-gold/50 hover:text-ivory peer-checked:border-gold peer-checked:bg-gold/10 peer-checked:text-gold peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-gold">
                {c.label}
              </span>
            </label>
          ))}
        </div>
      </section>

      {/* ---- who it is for ---- */}
      <section>
        <h2 className="font-mono text-[11px] uppercase tracking-[0.2em] text-gold">Customer</h2>
        <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {[
            { name: "name", label: "Name", required: true, autoComplete: "name", type: "text" },
            { name: "phone", label: "Phone", required: true, autoComplete: "tel", type: "tel" },
            { name: "email", label: "Email (optional)", required: false, autoComplete: "email", type: "email" },
          ].map((f) => (
            <label key={f.name} className="flex flex-col gap-1.5">
              <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-ivory-dim">
                {f.label}
                {f.required && <span className="ml-1 text-gold">*</span>}
              </span>
              <input
                name={f.name}
                type={f.type}
                required={f.required}
                autoComplete={f.autoComplete}
                className="min-h-11 rounded-md border border-line bg-transparent px-3 py-2.5 text-sm text-ivory focus:border-gold focus:outline-none"
              />
            </label>
          ))}

          <label className="flex flex-col gap-1.5 sm:col-span-2">
            <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-ivory-dim">
              Delivery address <span className="ml-1 text-gold">*</span>
            </span>
            <textarea
              name="address"
              required
              rows={2}
              className="min-h-11 resize-none rounded-md border border-line bg-transparent px-3 py-2.5 text-sm text-ivory focus:border-gold focus:outline-none"
            />
          </label>

          <label className="flex flex-col gap-1.5 sm:col-span-2">
            <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-ivory-dim">
              Note (optional)
            </span>
            <input
              name="notes"
              type="text"
              placeholder="e.g. asked for it gift wrapped"
              className="min-h-11 rounded-md border border-line bg-transparent px-3 py-2.5 text-sm text-ivory placeholder:text-ivory-dim/60 focus:border-gold focus:outline-none"
            />
          </label>
        </div>
      </section>

      {/* ---- how they are paying ---- */}
      <section>
        <h2 className="font-mono text-[11px] uppercase tracking-[0.2em] text-gold">Payment</h2>
        <div className="mt-3 flex flex-col gap-3">
          {[
            { value: "transfer", label: "Bank transfer" },
            { value: "cash", label: "Cash on delivery" },
          ].map((m, i) => (
            <label key={m.value} className="flex min-h-11 items-center gap-3 text-sm text-ivory">
              <input
                type="radio"
                name="paymentMethod"
                value={m.value}
                defaultChecked={i === 0}
                required
                className="h-4 w-4 accent-[var(--gold-deep)]"
              />
              {m.label}
            </label>
          ))}

          <label className="mt-2 flex min-h-11 items-start gap-3 border border-line p-4 text-sm text-ivory">
            <input type="checkbox" name="markPaid" className="mt-0.5 h-4 w-4 accent-[var(--gold-deep)]" />
            <span>
              Payment already received
              <span className="mt-1 block text-[11px] leading-relaxed text-ivory-dim">
                Confirms the order straight away and issues its tax invoice. Leave unticked if you are
                still waiting for the transfer.
              </span>
            </span>
          </label>
        </div>
      </section>

      {error && (
        <p role="alert" className="border border-red-400/40 bg-red-400/5 px-4 py-3 text-sm text-red-400">
          {error}
        </p>
      )}

      <div className="flex items-center justify-end gap-4 border-t border-line pt-6">
        <button
          type="submit"
          disabled={pending || lines.length === 0}
          className="min-h-11 bg-gold-deep px-8 font-mono text-[11px] uppercase tracking-[0.15em] text-ink transition-opacity hover:bg-gold-deep/90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {pending ? "Creating…" : "Create order"}
        </button>
      </div>
    </form>
  );
}
