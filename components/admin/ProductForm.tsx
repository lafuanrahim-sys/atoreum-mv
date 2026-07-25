"use client";

import { useState } from "react";
import Image from "next/image";
import type { Product } from "@/lib/types";
import { CATEGORIES } from "@/lib/types";

/**
 * Shared create/edit form. Deliberately plain — this is an internal tool.
 * The parent page binds `action` to either createProductAction or
 * updateProductAction (bound with the product id via .bind()).
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
  const [existingImages, setExistingImages] = useState(product?.images ?? []);
  // An existing product whose brand was later removed from the list still
  // shows (and keeps) its own brand rather than silently switching.
  const brandOptions =
    product?.brand && !brands.includes(product.brand) ? [product.brand, ...brands] : brands;

  return (
    <form action={action} className="flex max-w-2xl flex-col gap-6">
      <div className="grid grid-cols-2 gap-4">
        <TextField label="Name" name="name" defaultValue={product?.name} required />
        <TextField label="SKU" name="sku" defaultValue={product?.sku} required />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <TextField
          label="Size (volume/weight, e.g. 200ml)"
          name="size"
          defaultValue={product?.size}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <label className="flex flex-col gap-1">
          <span className="text-xs uppercase tracking-wide text-ivory-dim">Brand</span>
          <select
            name="brand"
            defaultValue={product?.brand ?? brandOptions[0]}
            className="border border-line bg-transparent px-3 py-2 text-sm text-ivory"
          >
            {brandOptions.map((b) => (
              <option key={b} value={b} className="bg-ink-2">
                {b}
              </option>
            ))}
          </select>
          <span className="text-[11px] text-ivory-dim/80">
            Missing a brand? Add it under Settings → Brands.
          </span>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs uppercase tracking-wide text-ivory-dim">Category</span>
          <select
            name="category"
            defaultValue={product?.category ?? CATEGORIES[0]}
            className="border border-line bg-transparent px-3 py-2 text-sm text-ivory"
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c} className="bg-ink-2">
                {c}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <TextField label="Price" name="price" type="number" step="0.01" defaultValue={product?.price} required />
        <TextField
          label="On-hand stock"
          name="stockOnHand"
          type="number"
          step="1"
          defaultValue={product?.stockOnHand ?? 0}
        />
        <label className="flex flex-col gap-1">
          <span className="text-xs uppercase tracking-wide text-ivory-dim">Currency</span>
          <select
            name="currency"
            defaultValue={product?.currency ?? "MVR"}
            className="border border-line bg-transparent px-3 py-2 text-sm text-ivory"
          >
            <option value="MVR" className="bg-ink-2">MVR</option>
            <option value="USD" className="bg-ink-2">USD</option>
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs uppercase tracking-wide text-ivory-dim">Stock Status</span>
          <select
            name="stockStatus"
            defaultValue={product?.stockStatus ?? "in-stock"}
            className="border border-line bg-transparent px-3 py-2 text-sm text-ivory"
          >
            <option value="in-stock" className="bg-ink-2">In Stock</option>
            <option value="low-stock" className="bg-ink-2">Low Stock</option>
            <option value="out-of-stock" className="bg-ink-2">Out of Stock</option>
          </select>
        </label>
      </div>

      <TextArea label="Description (short)" name="description" defaultValue={product?.description} rows={2} />

      <div className="grid grid-cols-1 gap-3">
        <span className="text-xs uppercase tracking-wide text-ivory-dim">
          Headlines (3 alternate taglines, rotated on the product page)
        </span>
        <TextField label="Headline 1" name="headline1" defaultValue={product?.headlines?.[0]} />
        <TextField label="Headline 2" name="headline2" defaultValue={product?.headlines?.[1]} />
        <TextField label="Headline 3" name="headline3" defaultValue={product?.headlines?.[2]} />
      </div>

      <TextArea label="Ingredients" name="ingredients" defaultValue={product?.ingredients} rows={4} />
      <TextArea label="How to Use" name="howToUse" defaultValue={product?.howToUse} rows={3} />

      <label className="flex items-center gap-2 text-sm text-ivory">
        <input type="checkbox" name="featured" defaultChecked={product?.featured} />
        Featured on homepage
      </label>

      <div>
        <span className="text-xs uppercase tracking-wide text-ivory-dim">Images</span>

        {existingImages.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-3">
            {existingImages.map((img) => (
              <div key={img} className="relative h-20 w-20 overflow-hidden rounded-sm border border-line bg-photo-well">
                <div className="absolute inset-1.5">
                  <Image src={img} alt="" fill className="object-contain" />
                </div>
                <input type="hidden" name="existingImages" value={img} />
                <button
                  type="button"
                  onClick={() => setExistingImages((prev) => prev.filter((p) => p !== img))}
                  className="absolute right-0 top-0 bg-ink/80 px-1 text-[10px] text-ivory-dim hover:text-gold"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}

        <input
          type="file"
          name="images"
          multiple
          accept="image/jpeg,image/png,image/webp,image/svg+xml"
          className="mt-3 block text-sm text-ivory-dim file:mr-4 file:border-0 file:bg-gold-deep file:px-4 file:py-2 file:text-xs file:uppercase file:text-ink"
        />
        <p className="mt-1 text-xs text-ivory-dim">
          {product ? "Add more, or remove above — at least one image must remain." : "At least one image is required."}
        </p>
      </div>

      <button
        type="submit"
        className="self-start bg-gold-deep px-6 py-3 text-xs uppercase tracking-[0.15em] text-ink hover:bg-gold-deep/90"
      >
        {product ? "Save Changes" : "Create Product"}
      </button>
    </form>
  );
}

function TextField({
  label,
  name,
  defaultValue,
  type = "text",
  step,
  required,
}: {
  label: string;
  name: string;
  defaultValue?: string | number;
  type?: string;
  step?: string;
  required?: boolean;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs uppercase tracking-wide text-ivory-dim">{label}</span>
      <input
        type={type}
        name={name}
        step={step}
        defaultValue={defaultValue}
        required={required}
        className="border border-line bg-transparent px-3 py-2 text-sm text-ivory focus:border-gold focus:outline-none"
      />
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
    <label className="flex flex-col gap-1">
      <span className="text-xs uppercase tracking-wide text-ivory-dim">{label}</span>
      <textarea
        name={name}
        rows={rows}
        defaultValue={defaultValue}
        className="border border-line bg-transparent px-3 py-2 text-sm text-ivory focus:border-gold focus:outline-none"
      />
    </label>
  );
}
