"use client";

import { useRef, useState } from "react";
import { setProductDiscountAction } from "@/app/actions/products";

/**
 * Set a product's discount straight from the products table, as either a
 * percentage or a flat sum off.
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
 *
 * The unit is a button, not a second input. A row is roughly 60px of width to
 * work with, and the choice is binary -- one tap on "%" turns it into "MVR"
 * and the same typed number now means something else, which is exactly how
 * the decision is actually made ("call it 30% off... no, make it 100 off").
 */
type Kind = "percent" | "amount";

export default function InlineDiscountField({
  productId,
  percent,
  amount,
  currency,
  price,
  priceEffective,
  back,
}: {
  productId: string;
  percent: number;
  amount: number;
  currency: string;
  /** Listing price, so the row can show what a typed discount would yield. */
  price: number;
  priceEffective: number;
  /** Where to return to, so filters and the current page survive the save. */
  back: string;
}) {
  const formRef = useRef<HTMLFormElement | null>(null);
  // Whichever kind the product already carries is the one shown. A product
  // with neither falls back to percent, the more common case.
  const initialKind: Kind = amount > 0 ? "amount" : "percent";
  const savedValue = amount > 0 ? amount : percent;

  const [kind, setKind] = useState<Kind>(initialKind);
  const [draft, setDraft] = useState(String(savedValue));

  const dirty = Number(draft || 0) !== savedValue || kind !== initialKind;

  const preview = (() => {
    const n = Number(draft || 0);
    if (!Number.isFinite(n) || n <= 0) return null;
    const next = kind === "amount" ? price - n : price * (1 - n / 100);
    return Math.max(0, Math.round(next * 100) / 100);
  })();

  const submitIfDirty = () => {
    if (dirty) formRef.current?.requestSubmit();
  };

  return (
    <form
      ref={formRef}
      action={setProductDiscountAction.bind(null, productId)}
      className="flex flex-col gap-0.5"
    >
      <input type="hidden" name="back" value={back} />
      <input type="hidden" name="discountKind" value={kind} />
      <div className="flex items-center gap-1">
        <input
          // A form-filling browser extension stamps fdprocessedid="..." onto
          // this input before React hydrates, so the server HTML and the DOM
          // disagree on an attribute this code never wrote. Nothing here can
          // prevent that, and the mismatch is cosmetic -- the value, the
          // handlers and the submitted form are unaffected. Suppressing is
          // scoped to this element's own attributes, so a real mismatch in
          // any child would still be reported.
          suppressHydrationWarning
          name="discountValue"
          type="number"
          min={0}
          // The ceiling depends on the unit: 95% of the price, or the whole
          // price in money. Both are re-checked on the server and by a check
          // constraint -- this only stops the arrow keys running past.
          max={kind === "amount" ? price : 95}
          step={kind === "amount" ? "1" : "0.5"}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={submitIfDirty}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              if (dirty) formRef.current?.requestSubmit();
              else (e.target as HTMLInputElement).blur();
            }
            // Esc abandons the edit rather than committing a typo.
            if (e.key === "Escape") {
              setDraft(String(savedValue));
              setKind(initialKind);
              (e.target as HTMLInputElement).blur();
            }
          }}
          aria-label={kind === "amount" ? `Discount in ${currency}` : "Discount percent"}
          className={`w-14 border-b bg-transparent px-1 py-1 text-right font-mono text-xs tabular-nums focus:outline-none ${
            dirty ? "border-gold-deep text-gold-deep" : "border-line text-ivory-dim"
          }`}
        />
        <button
          type="button"
          onClick={() => setKind((k) => (k === "percent" ? "amount" : "percent"))}
          // Not a submit: switching the unit alone changes what the number
          // means, so it marks the row dirty and the existing blur/Enter path
          // saves it. Firing a write on every toggle would save a half-decided
          // discount the moment it was toggled past.
          title={`Switch to ${kind === "percent" ? `flat ${currency} off` : "percent off"}`}
          aria-label={`Discount unit: ${kind === "percent" ? "percent" : currency}. Click to switch.`}
          className="min-w-[26px] cursor-pointer border-b border-dashed border-line/60 font-mono text-[10px] text-ivory-dim transition-colors hover:border-gold-deep hover:text-gold-deep"
        >
          {kind === "percent" ? "%" : currency}
        </button>
      </div>
      <span className="font-mono text-[10px] text-ivory-dim/70 tabular-nums">
        {preview !== null
          ? `→ ${currency} ${preview.toLocaleString("en-US")}`
          : savedValue > 0
            ? `→ ${currency} ${priceEffective.toLocaleString("en-US")}`
            : ""}
      </span>
    </form>
  );
}
