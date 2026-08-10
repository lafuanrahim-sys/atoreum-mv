"use client";

import { useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Image from "next/image";
import type { Product } from "@/lib/types";
import { CATEGORIES } from "@/lib/types";

const STOCK_LABEL: Record<string, string> = {
  "in-stock": "In Stock",
  "low-stock": "Low Stock",
  "out-of-stock": "Out of Stock",
};

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Shared create/edit form. The parent page binds `action` to either
 * createProductAction or updateProductAction (bound with the product id
 * via .bind()).
 */
export default function ProductForm({
  product,
  action,
  brands,
}: {
  product?: Product;
  action: (formData: FormData) => void | Promise<void>;
  /** Brand options from the brands store (Dashboard → Settings to add more). */
  brands: string[];
}) {
  // Set by createProductAction/updateProductAction when a save is rejected
  // for something the admin can fix -- a listing price under the minimum,
  // a discount that would breach it, a band out of order. Read here rather
  // than passed down, so neither page has to thread it through.
  const saveError = useSearchParams().get("error");
  const [existingImages, setExistingImages] = useState(product?.images ?? []);
  const [newFiles, setNewFiles] = useState<{ file: File; url: string }[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  // An existing product whose brand was later removed from the list still
  // shows (and keeps) its own brand rather than silently switching.
  const brandOptions =
    product?.brand && !brands.includes(product.brand) ? [product.brand, ...brands] : brands;

  // The real <input type="file"> is the thing FormData reads on submit, so
  // dropped/added files get synced onto its (browser-only settable)
  // .files property via a DataTransfer buffer — state here just drives the
  // preview strip.
  const syncInputFiles = (entries: { file: File }[]) => {
    const dt = new DataTransfer();
    entries.forEach((e) => dt.items.add(e.file));
    if (fileInputRef.current) fileInputRef.current.files = dt.files;
  };

  const addFiles = (incoming: FileList | File[]) => {
    const accepted = Array.from(incoming).filter((f) =>
      ["image/jpeg", "image/png", "image/webp"].includes(f.type)
    );
    if (!accepted.length) return;
    setNewFiles((prev) => {
      const next = [...prev, ...accepted.map((file) => ({ file, url: URL.createObjectURL(file) }))];
      syncInputFiles(next);
      return next;
    });
  };

  const removeNewFile = (index: number) => {
    setNewFiles((prev) => {
      URL.revokeObjectURL(prev[index].url);
      const next = prev.filter((_, i) => i !== index);
      syncInputFiles(next);
      return next;
    });
  };

  return (
    <form action={action} className="flex max-w-2xl flex-col gap-10">
      {saveError && (
        <p role="alert" className="border border-red-400/50 bg-red-400/5 px-4 py-3 text-sm text-red-400">
          {saveError}
        </p>
      )}
      <FormSection eyebrow="01" title="Identity">
        <div className="grid grid-cols-2 gap-5">
          <TextField label="Name" name="name" defaultValue={product?.name} required />
          <TextField label="SKU" name="sku" defaultValue={product?.sku} required />
        </div>
        <TextField label="Size (volume/weight, e.g. 200ml)" name="size" defaultValue={product?.size} />
      </FormSection>

      <FormSection eyebrow="02" title="Classification">
        <div className="grid grid-cols-2 gap-5">
          <SelectField label="Brand" name="brand" defaultValue={product?.brand ?? brandOptions[0]} hint="Missing a brand? Add it under Settings → Brands.">
            {brandOptions.map((b) => (
              <option key={b} value={b} className="bg-ink-2">
                {b}
              </option>
            ))}
          </SelectField>
          <SelectField label="Category" name="category" defaultValue={product?.category ?? CATEGORIES[0]}>
            {CATEGORIES.map((c) => (
              <option key={c} value={c} className="bg-ink-2">
                {c}
              </option>
            ))}
          </SelectField>
        </div>
      </FormSection>

      <FormSection eyebrow="03" title="Pricing & Stock">
        {/* The price band, floor first and reading left to right in the order
            the numbers relate to each other: minimum, then the listing price
            that has to clear it, then the median and ceiling it is judged
            against. Only two of these are ever charged from — the listing
            price, and the discount applied to it. Median and maximum are
            reference figures for whoever is setting the price. */}
        <div className="grid grid-cols-2 gap-5 sm:grid-cols-4">
          <TextField
            label="Minimum"
            name="priceMin"
            type="number"
            step="0.01"
            min={0}
            defaultValue={product?.priceMin ?? 0}
            hint="Never sell below this"
          />
          <TextField
            label="Listing price"
            name="price"
            type="number"
            step="0.01"
            min={product?.priceMin ?? 0}
            defaultValue={product?.price}
            required
            hint="What the site charges"
          />
          <TextField
            label="Median"
            name="priceMedian"
            type="number"
            step="0.01"
            min={0}
            defaultValue={product?.priceMedian ?? ""}
            hint="Reference only"
          />
          <TextField
            label="Maximum"
            name="priceMax"
            type="number"
            step="0.01"
            min={0}
            defaultValue={product?.priceMax ?? ""}
            hint="Reference only"
          />
        </div>
        <div className="grid grid-cols-2 gap-5 sm:grid-cols-4">
          <TextField
            label="Discount %"
            name="discountPercent"
            type="number"
            step="0.01"
            min={0}
            max={95}
            defaultValue={product?.discountPercent ?? 0}
            hint={
              product && product.discountPercent > 0
                ? `Now selling at ${product.currency} ${product.priceEffective.toLocaleString("en-US")}`
                : "0 = no offer"
            }
          />
          <TextField label="On-hand stock" name="stockOnHand" type="number" step="1" defaultValue={product?.stockOnHand ?? 0} />
          <SelectField label="Currency" name="currency" defaultValue={product?.currency ?? "MVR"}>
            <option value="MVR" className="bg-ink-2">MVR</option>
            <option value="USD" className="bg-ink-2">USD</option>
          </SelectField>
          {/* Stock status is no longer a choice -- the database derives it from
              units on hand (0 out, 1-2 low, 3+ in). A dropdown here would let
              a product claim "In Stock" with nothing on the shelf, which is
              exactly the drift this replaced. Shown read-only so the rule is
              visible where the number is edited. */}
          <div className="flex flex-col gap-1.5">
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-ivory-dim">Stock status</span>
            <span className="px-1 py-2 font-mono text-sm text-ivory">
              {product ? STOCK_LABEL[product.stockStatus] : "From units on hand"}
            </span>
            <span className="text-[10px] leading-tight text-ivory-dim/70">Automatic: 0 out, 1-2 low, 3+ in</span>
          </div>
        </div>
        <label className="flex items-center gap-2.5 font-mono text-xs uppercase tracking-[0.15em] text-ivory">
          <input type="checkbox" name="featured" defaultChecked={product?.featured} className="accent-gold-deep" />
          Featured on homepage
        </label>
      </FormSection>

      <FormSection eyebrow="04" title="Copy">
        <TextArea label="Description (short)" name="description" defaultValue={product?.description} rows={2} />

        <div className="flex flex-col gap-4">
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-ivory-dim">
            Headlines: 3 alternate taglines, rotated on the product page
          </span>
          <TextField label="Headline 1" name="headline1" defaultValue={product?.headlines?.[0]} />
          <TextField label="Headline 2" name="headline2" defaultValue={product?.headlines?.[1]} />
          <TextField label="Headline 3" name="headline3" defaultValue={product?.headlines?.[2]} />
        </div>

        <TextArea label="Ingredients" name="ingredients" defaultValue={product?.ingredients} rows={4} />
        <TextArea label="How to Use" name="howToUse" defaultValue={product?.howToUse} rows={3} />
      </FormSection>

      <FormSection eyebrow="05" title="Images">
        {existingImages.length > 0 && (
          <div className="flex flex-wrap gap-3">
            {existingImages.map((img) => (
              <div key={img} className="relative h-20 w-20 overflow-hidden border border-line bg-photo-well">
                <div className="absolute inset-1.5">
                  <Image src={img} alt="" fill className="object-contain" />
                </div>
                <input type="hidden" name="existingImages" value={img} />
                <button
                  type="button"
                  onClick={() => setExistingImages((prev) => prev.filter((p) => p !== img))}
                  aria-label="Remove image"
                  className="absolute right-0 top-0 bg-ink/80 p-1 text-ivory-dim hover:text-gold-deep"
                >
                  <svg viewBox="0 0 10 10" aria-hidden="true" className="h-2.5 w-2.5">
                    <path d="M1 1l8 8M9 1l-8 8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}

        {newFiles.length > 0 && (
          <div className="flex flex-wrap gap-3">
            {newFiles.map(({ file, url }, i) => (
              <div key={`${file.name}-${i}`} className="relative h-20 w-20 overflow-hidden border border-gold-deep/50 bg-photo-well">
                {/* Local blob preview — next/image can't optimize object URLs. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={url}
                  alt=""
                  className="absolute inset-1.5 h-[calc(100%-0.75rem)] w-[calc(100%-0.75rem)] object-contain"
                />
                <button
                  type="button"
                  onClick={() => removeNewFile(i)}
                  aria-label={`Remove ${file.name}`}
                  className="absolute right-0 top-0 bg-ink/80 p-1 text-ivory-dim hover:text-gold-deep"
                >
                  <svg viewBox="0 0 10 10" aria-hidden="true" className="h-2.5 w-2.5">
                    <path d="M1 1l8 8M9 1l-8 8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          name="images"
          multiple
          accept="image/jpeg,image/png,image/webp"
          className="sr-only"
          tabIndex={-1}
          aria-hidden="true"
          onChange={(e) => e.target.files && addFiles(e.target.files)}
        />

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files);
          }}
          className={`flex min-h-24 w-full cursor-pointer flex-col items-center justify-center gap-1.5 border border-dashed px-6 py-5 text-center transition-colors focus:border-gold-deep focus:outline-none ${
            dragOver ? "border-gold-deep bg-gold-deep/5" : "border-line hover:border-ivory-dim"
          }`}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5 text-gold-deep">
            <path d="M12 15V4m0 0L8 8m4-4l4 4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M4 15v3a2 2 0 002 2h12a2 2 0 002-2v-3" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <span className="text-sm text-ivory">
            Drop images here, or <span className="text-gold-deep underline underline-offset-4">browse</span>
          </span>
          <span className="font-mono text-xs text-ivory-dim">JPG, PNG, WEBP, or SVG</span>
        </button>

        <p className="font-mono text-xs text-ivory-dim">
          {product ? "Add more, or remove above. At least one image must remain." : "At least one image is required."}
          {newFiles.length > 0 && ` ${newFiles.length} new file${newFiles.length > 1 ? "s" : ""} staged (${formatBytes(newFiles.reduce((s, f) => s + f.file.size, 0))}).`}
        </p>
      </FormSection>

      <button
        type="submit"
        className="self-start bg-gold-deep px-8 py-3.5 font-mono text-xs uppercase tracking-[0.2em] text-ink transition-colors hover:bg-gold-deep/90"
      >
        {product ? "Save Changes" : "Create Product"}
      </button>
    </form>
  );
}

function FormSection({ eyebrow, title, children }: { eyebrow: string; title: string; children: React.ReactNode }) {
  return (
    <fieldset className="m-0 flex flex-col gap-5 border-0 border-t border-line p-0 pt-6">
      <legend className="flex items-baseline gap-3 pb-1">
        <span className="font-mono text-[10px] text-sand">{eyebrow}</span>
        <span className="font-admin-heading text-lg font-semibold text-ivory">{title}</span>
      </legend>
      {children}
    </fieldset>
  );
}

function TextField({
  label,
  name,
  defaultValue,
  type = "text",
  step,
  min,
  max,
  required,
  hint,
}: {
  label: string;
  name: string;
  defaultValue?: string | number;
  type?: string;
  step?: string;
  /**
   * Native bounds, for immediate feedback while typing. Convenience only:
   * the binding limits are the check constraints on the products table and
   * the validation in updateProductAction, both of which a crafted POST has
   * to get past and this attribute does not.
   */
  min?: string | number;
  max?: string | number;
  required?: boolean;
  hint?: string;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-ivory-dim">{label}</span>
      <input
        type={type}
        name={name}
        step={step}
        min={min}
        max={max}
        defaultValue={defaultValue}
        required={required}
        className="border-b border-line bg-transparent px-1 py-2 font-mono text-sm text-ivory focus:border-gold-deep focus:outline-none"
      />
      {hint && <span className="text-[10px] leading-tight text-ivory-dim/70">{hint}</span>}
    </label>
  );
}

function SelectField({
  label,
  name,
  defaultValue,
  hint,
  children,
}: {
  label: string;
  name: string;
  defaultValue?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-ivory-dim">{label}</span>
      <select
        name={name}
        defaultValue={defaultValue}
        className="border-b border-line bg-transparent px-1 py-2 font-mono text-sm text-ivory focus:border-gold-deep focus:outline-none"
      >
        {children}
      </select>
      {hint && <span className="text-[11px] text-ivory-dim/80">{hint}</span>}
    </label>
  );
}

function TextArea({
  label,
  name,
  defaultValue,
  rows,
}: {
  label: string;
  name: string;
  defaultValue?: string;
  rows: number;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-ivory-dim">{label}</span>
      <textarea
        name={name}
        rows={rows}
        defaultValue={defaultValue}
        className="border border-line bg-transparent px-3 py-2 text-sm text-ivory focus:border-gold-deep focus:outline-none"
      />
    </label>
  );
}
