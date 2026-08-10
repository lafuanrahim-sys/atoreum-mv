"use server";

import crypto from "crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  createProduct,
  updateProduct,
  deleteProduct,
  getProductById,
  setProductDiscount,
} from "@/lib/data/products.server";
import { getCurrentUser } from "@/lib/auth/currentUser.server";
import { isAdminRole } from "@/lib/auth/userSession";
import { uploadPublicFile, PRODUCT_IMAGES_BUCKET } from "@/lib/storage";
import type { Category, ProductInput } from "@/lib/types";
import { CATEGORIES } from "@/lib/types";

/** Server actions are public endpoints — role-check inside, not just at the page. */
async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user || !isAdminRole(user.role)) redirect("/login");
}

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
// SVG deliberately excluded -- it's an XML format that can carry an embedded
// <script>, and product images have no real need to be vector art.
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

async function saveUploadedImages(formData: FormData): Promise<string[]> {
  const files = formData.getAll("images").filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length === 0) return [];

  const paths: string[] = [];

  for (const file of files) {
    if (file.size > MAX_IMAGE_BYTES) {
      throw new Error(`${file.name} is too large (max 8MB).`);
    }
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      throw new Error(`${file.name} must be a JPG, PNG, or WEBP.`);
    }
    // Derived from the whitelist rather than path.extname(), which on an
    // attacker-supplied filename can yield separators or traversal that
    // would then be concatenated into the object key.
    const extMatch = /\.(jpe?g|png|webp)$/i.exec(file.name);
    const safeName = `${Date.now()}-${crypto.randomUUID()}${extMatch ? extMatch[0].toLowerCase() : ""}`;
    const bytes = Buffer.from(await file.arrayBuffer());
    const url = await uploadPublicFile({
      bucket: PRODUCT_IMAGES_BUCKET,
      path: safeName,
      bytes,
      contentType: file.type,
    });
    paths.push(url);
  }

  return paths;
}

/**
 * A mistake the admin can fix by editing a field, as opposed to a bug.
 *
 * Thrown rather than returned because it can surface from deep inside field
 * parsing, and caught at the top of each action so the admin is sent back to
 * the form with the sentence. A bare `throw` in a Server Action reaches the
 * browser as "A server error occurred" plus an opaque digest, which is the
 * exact opposite of the point of writing a specific message.
 */
class ProductValidationError extends Error {}

/**
 * `?` only when the path has no query string yet, `&` when it does. The
 * products table hands back its own filter URL, so a naive `?error=` produced
 * "?q=Aqua+Cure?error=..." -- one query string containing a second `?`, which
 * browsers parse as a single parameter named "q" whose value happens to end in
 * "?error=...". The redirect worked and the message vanished.
 */
function errorHref(base: string, message: string): string {
  const sep = base.includes("?") ? "&" : "?";
  return `${base}${sep}error=${encodeURIComponent(message)}`;
}

/** A money field that may legitimately be left blank -> null, not 0. */
function optionalMoney(raw: FormDataEntryValue | null): number | null {
  const text = String(raw ?? "").trim();
  if (!text) return null;
  const n = Number(text);
  return Number.isFinite(n) ? n : null;
}

function money(raw: FormDataEntryValue | null): number {
  const n = Number(String(raw ?? "").trim());
  return Number.isFinite(n) ? n : 0;
}

function readProductFields(formData: FormData): Omit<ProductInput, "images"> {
  const category = String(formData.get("category")) as Category;
  if (!CATEGORIES.includes(category)) {
    throw new ProductValidationError("Invalid category.");
  }

  const price = money(formData.get("price"));
  const priceMin = Math.max(0, money(formData.get("priceMin")));
  const priceMedian = optionalMoney(formData.get("priceMedian"));
  const priceMax = optionalMoney(formData.get("priceMax"));
  const discountPercent = money(formData.get("discountPercent"));

  // These same rules are check constraints on the table, which is where the
  // real guarantee lives -- a crafted POST never reaches this function's
  // opinion about anything. They are repeated here only so the admin gets a
  // sentence explaining what went wrong instead of a raw Postgres violation.
  if (price < priceMin) {
    throw new ProductValidationError(
      `Listing price (${price.toLocaleString()}) is below the minimum (${priceMin.toLocaleString()}). ` +
        `Raise the listing price, or lower the minimum first.`
    );
  }
  if (discountPercent < 0 || discountPercent > 95) {
    throw new ProductValidationError("Discount must be between 0 and 95%.");
  }
  if (priceMax !== null && priceMax < priceMin) {
    throw new ProductValidationError("Maximum price cannot be below the minimum price.");
  }
  if (priceMedian !== null && (priceMedian < priceMin || (priceMax !== null && priceMedian > priceMax))) {
    throw new ProductValidationError("Median price must sit between the minimum and the maximum.");
  }
  // A discount is applied to the listing price, so it can walk the customer
  // straight through the floor the minimum exists to defend. Checked here
  // rather than in the database because it depends on the discount, and a
  // generated column cannot be referenced from a check constraint.
  const effective = Math.round(price * (1 - discountPercent / 100) * 100) / 100;
  if (effective < priceMin) {
    throw new ProductValidationError(
      `A ${discountPercent}% discount takes the price to ${effective.toLocaleString()}, ` +
        `below the minimum of ${priceMin.toLocaleString()}. Reduce the discount.`
    );
  }
  const headlines: [string, string, string] = [
    String(formData.get("headline1") ?? "").trim(),
    String(formData.get("headline2") ?? "").trim(),
    String(formData.get("headline3") ?? "").trim(),
  ];

  return {
    sku: String(formData.get("sku") ?? "").trim(),
    name: String(formData.get("name") ?? "").trim(),
    size: String(formData.get("size") ?? "").trim(),
    brand: String(formData.get("brand") ?? "Lebelage").trim(),
    category,
    price,
    priceMin,
    priceMedian,
    priceMax,
    discountPercent,
    currency: (String(formData.get("currency") ?? "MVR") as ProductInput["currency"]),
    description: String(formData.get("description") ?? "").trim(),
    headlines,
    ingredients: String(formData.get("ingredients") ?? "").trim(),
    howToUse: String(formData.get("howToUse") ?? "").trim(),
    stockOnHand: Math.max(0, Math.floor(Number(formData.get("stockOnHand") ?? 0)) || 0),
    featured: formData.get("featured") === "on",
  };
}

/**
 * Set one product's discount from the products table, without opening the
 * editor. Deliberately narrow: it writes discount_percent and nothing else,
 * so a stray field in the posted form can't quietly change a price, a name or
 * a stock level through a route meant for one number.
 *
 * The floor still applies. A discount is taken off the listing price, so it
 * can push the customer-facing price under the minimum even when the listing
 * price itself clears it -- the same check the full editor runs.
 */
export async function setProductDiscountAction(id: string, formData: FormData) {
  await requireAdmin();
  // `back` carries the admin's current filters/page so they land where they
  // were. It arrives from the client, so it is validated before being handed
  // to redirect(): a value like "//evil.example" or "https://evil.example"
  // would otherwise turn this into an open redirect that borrows the admin's
  // trust in the dashboard's own domain.
  const backRaw = String(formData.get("back") ?? "");
  const back =
    backRaw.startsWith("/dashboard/products") && !backRaw.startsWith("//") && !backRaw.includes("\\")
      ? backRaw
      : "/dashboard/products";
  const raw = String(formData.get("discountPercent") ?? "").trim();
  const percent = raw === "" ? 0 : Number(raw);

  const product = await getProductById(id);
  if (!product) redirect(errorHref("/dashboard/products", "That product no longer exists."));

  let message: string | null = null;
  if (!Number.isFinite(percent) || percent < 0 || percent > 95) {
    message = "Discount must be a number between 0 and 95.";
  } else {
    const effective = Math.round(product.price * (1 - percent / 100) * 100) / 100;
    if (effective < product.priceMin) {
      message =
        `${product.name}: a ${percent}% discount gives ${effective.toLocaleString()}, ` +
        `below its minimum of ${product.priceMin.toLocaleString()}.`;
    }
  }
  if (message) redirect(errorHref(back, message));

  await setProductDiscount(id, percent);
  revalidatePath("/dashboard/products");
  revalidatePath("/products");
  revalidatePath(`/products/${id}`);
  redirect(back);
}

export async function createProductAction(formData: FormData) {
  await requireAdmin();
  let fields: Omit<ProductInput, "images">;
  try {
    fields = readProductFields(formData);
    if (!fields.name || !fields.sku) {
      throw new ProductValidationError("Name and SKU are required.");
    }
  } catch (err) {
    // Outside the try, so the NEXT_REDIRECT this throws is not swallowed.
    if (err instanceof ProductValidationError) redirect(errorHref("/dashboard/products/new", err.message));
    throw err;
  }

  const uploaded = await saveUploadedImages(formData);
  if (uploaded.length === 0) {
    redirect(errorHref("/dashboard/products/new", "At least one product image is required."));
  }

  // Awaited. Unawaited, the redirect below fired while the insert was still
  // in flight, so a write the database REJECTED — which the new price
  // constraints make a real possibility rather than a theoretical one —
  // landed as an unhandled rejection and the admin was sent to the product
  // list as though it had saved.
  await createProduct({ ...fields, images: uploaded });
  revalidatePath("/dashboard/products");
  revalidatePath("/products");
  redirect("/dashboard/products");
}

export async function updateProductAction(id: string, formData: FormData) {
  await requireAdmin();
  const editHref = `/dashboard/products/${id}/edit`;
  let fields: Omit<ProductInput, "images">;
  try {
    fields = readProductFields(formData);
  } catch (err) {
    if (err instanceof ProductValidationError) redirect(errorHref(editHref, err.message));
    throw err;
  }
  const uploaded = await saveUploadedImages(formData);

  const keepExisting = formData
    .getAll("existingImages")
    .map(String)
    .filter(Boolean);

  const images = [...keepExisting, ...uploaded];
  if (images.length === 0) {
    redirect(errorHref(editHref, "At least one product image is required."));
  }

  await updateProduct(id, { ...fields, images });
  revalidatePath("/dashboard/products");
  revalidatePath(`/dashboard/products/${id}/edit`);
  revalidatePath("/products");
  revalidatePath(`/products/${id}`);
  redirect("/dashboard/products");
}

export async function deleteProductAction(id: string) {
  await requireAdmin();
  deleteProduct(id);
  revalidatePath("/dashboard/products");
  revalidatePath("/products");
}
