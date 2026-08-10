"use client";

import { useRef, useState } from "react";
import { setProductDiscountAction } from "@/app/actions/products";

/**
 * Set a product's discount straight from the products table.
 *
 * One tiny form per row rather than a single bulk form for the page: each
 * submits only its own product's number, so a save can never carry a
 * half-typed value from three rows away, and a rejected discount on one
 * product doesn't discard edits made to the others.
 *
 * It submits on blur and on Enter rather than behind a Save button, because
 * the whole point of putting this in the table is not having to make a second
 * deliberate action to change one number. `dirty` gates that: without it,
 * tabbing across a table of 20 rows would fire 20 pointless writes.
 */
export default function InlineDiscountField({
  productId,
  value,
  currency,
  price,
  priceEffective,
  back,
}: {
  productId: string;
  value: number;
  currency: string;
  /** Listing price, so the row can show what a typed discount would yield. */
  price: number;
  priceEffective: number;
  /** Where to return to, so filters and the current page survive the save. */
  back: string;
}) {
  const formRef = useRef<HTMLFormElement | null>(null);
  const [draft, setDraft] = useState(String(value));
  const dirty = Number(draft || 0) !== value;

  const preview = (() => {
    const pct = Number(draft || 0);
    if (!Number.isFinite(pct) || pct <= 0) return null;
    return Math.round(price * (1 - pct / 100) * 100) / 100;
  })();

  return (
    <form
      ref={formRef}
      action={setProductDiscountAction.bind(null, productId)}
      className="flex flex-col gap-0.5"
    >
      <input type="hidden" name="back" value={back} />
      <div className="flex items-center gap-1">
        <input
          name="discountPercent"
          type="number"
          min={0}
          max={95}
          step="0.5"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => {
            if (dirty) formRef.current?.requestSubmit();
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              if (dirty) formRef.current?.requestSubmit();
              else (e.target as HTMLInputElement).blur();
            }
            // Esc abandons the edit rather than committing a typo.
            if (e.key === "Escape") {
              setDraft(String(value));
              (e.target as HTMLInputElement).blur();
            }
          }}
          aria-label="Discount percent"
          className={`w-14 border-b bg-transparent px-1 py-1 text-right font-mono text-xs tabular-nums focus:outline-none ${
            dirty ? "border-gold-deep text-gold-deep" : "border-line text-ivory-dim"
          }`}
        />
        <span className="font-mono text-[10px] text-ivory-dim">%</span>
      </div>
      <span className="font-mono text-[10px] text-ivory-dim/70 tabular-nums">
        {preview !== null
          ? `→ ${currency} ${preview.toLocaleString("en-US")}`
          : value > 0
            ? `→ ${currency} ${priceEffective.toLocaleString("en-US")}`
            : ""}
      </span>
    </form>
  );
}
