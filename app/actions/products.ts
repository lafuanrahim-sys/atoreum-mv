"use server";

import fs from "fs/promises";
import path from "path";
import crypto from "crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  createProduct,
  updateProduct,
  deleteProduct,
} from "@/lib/data/products.server";
import type { Category, ProductInput, StockStatus } from "@/lib/types";
import { CATEGORIES } from "@/lib/types";

const IMAGE_DIR = path.join(process.cwd(), "public", "images", "products");
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/svg+xml"];

async function saveUploadedImages(formData: FormData): Promise<string[]> {
  const files = formData.getAll("images").filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length === 0) return [];

  await fs.mkdir(IMAGE_DIR, { recursive: true });
  const paths: string[] = [];

  for (const file of files) {
    if (file.size > MAX_IMAGE_BYTES) {
      throw new Error(`${file.name} is too large (max 8MB).`);
    }
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      throw new Error(`${file.name} must be a JPG, PNG, WEBP, or SVG.`);
    }
    const ext = path.extname(file.name) || "";
    const safeName = `${Date.now()}-${crypto.randomUUID()}${ext}`;
    const bytes = Buffer.from(await file.arrayBuffer());
    await fs.writeFile(path.join(IMAGE_DIR, safeName), bytes);
    paths.push(`/images/products/${safeName}`);
  }

  return paths;
}

function readProductFields(formData: FormData): Omit<ProductInput, "images"> {
  const category = String(formData.get("category")) as Category;
  if (!CATEGORIES.includes(category)) {
    throw new Error("Invalid category.");
  }
  const stockStatus = String(formData.get("stockStatus")) as StockStatus;

  return {
    sku: String(formData.get("sku") ?? "").trim(),
    name: String(formData.get("name") ?? "").trim(),
    brand: String(formData.get("brand") ?? "Lebelage").trim(),
    category,
    price: Number(formData.get("price") ?? 0),
    currency: (String(formData.get("currency") ?? "MVR") as ProductInput["currency"]),
    description: String(formData.get("description") ?? "").trim(),
    details: String(formData.get("details") ?? "").trim(),
    stockStatus,
    featured: formData.get("featured") === "on",
  };
}

export async function createProductAction(formData: FormData) {
  const fields = readProductFields(formData);
  if (!fields.name || !fields.sku) {
    throw new Error("Name and SKU are required.");
  }

  const uploaded = await saveUploadedImages(formData);
  if (uploaded.length === 0) {
    throw new Error("At least one product image is required.");
  }

  createProduct({ ...fields, images: uploaded });
  revalidatePath("/admin/products");
  revalidatePath("/products");
  redirect("/admin/products");
}

export async function updateProductAction(id: string, formData: FormData) {
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
  revalidatePath("/admin/products");
  revalidatePath(`/admin/products/${id}/edit`);
  revalidatePath("/products");
  revalidatePath(`/products/${id}`);
  redirect("/admin/products");
}

export async function deleteProductAction(id: string) {
  deleteProduct(id);
  revalidatePath("/admin/products");
  revalidatePath("/products");
}
