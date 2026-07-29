"use server";

import path from "path";
import crypto from "crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  createProduct,
  updateProduct,
  deleteProduct,
} from "@/lib/data/products.server";
import { getCurrentUser } from "@/lib/auth/currentUser.server";
import { isAdminRole } from "@/lib/auth/userSession";
import { uploadPublicFile, PRODUCT_IMAGES_BUCKET } from "@/lib/storage";
import type { Category, ProductInput, StockStatus } from "@/lib/types";
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
    const ext = path.extname(file.name) || "";
    const safeName = `${Date.now()}-${crypto.randomUUID()}${ext}`;
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

function readProductFields(formData: FormData): Omit<ProductInput, "images"> {
  const category = String(formData.get("category")) as Category;
  if (!CATEGORIES.includes(category)) {
    throw new Error("Invalid category.");
  }
  const stockStatus = String(formData.get("stockStatus")) as StockStatus;
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
    price: Number(formData.get("price") ?? 0),
    currency: (String(formData.get("currency") ?? "MVR") as ProductInput["currency"]),
    description: String(formData.get("description") ?? "").trim(),
    headlines,
    ingredients: String(formData.get("ingredients") ?? "").trim(),
    howToUse: String(formData.get("howToUse") ?? "").trim(),
    stockStatus,
    stockOnHand: Math.max(0, Math.floor(Number(formData.get("stockOnHand") ?? 0)) || 0),
    featured: formData.get("featured") === "on",
  };
}

export async function createProductAction(formData: FormData) {
  await requireAdmin();
  const fields = readProductFields(formData);
  if (!fields.name || !fields.sku) {
    throw new Error("Name and SKU are required.");
  }

  const uploaded = await saveUploadedImages(formData);
  if (uploaded.length === 0) {
    throw new Error("At least one product image is required.");
  }

  createProduct({ ...fields, images: uploaded });
  revalidatePath("/dashboard/products");
  revalidatePath("/products");
  redirect("/dashboard/products");
}

export async function updateProductAction(id: string, formData: FormData) {
  await requireAdmin();
  const fields = readProductFields(formData);
  const uploaded = await saveUploadedImages(formData);

  const keepExisting = formData
    .getAll("existingImages")
    .map(String)
    .filter(Boolean);

  const images = [...keepExisting, ...uploaded];
  if (images.length === 0) {
    throw new Error("At least one product image is required.");
  }

  updateProduct(id, { ...fields, images });
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
