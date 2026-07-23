"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/currentUser.server";
import { addBrand, removeBrand } from "@/lib/data/brands.server";
import { saveSettings } from "@/lib/data/settings.server";
import {
  createReview,
  deleteReview,
  setReviewStatus,
} from "@/lib/data/reviews.server";

async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") redirect("/login");
  return user;
}

/* ---------- Brands (Dashboard → Settings) ---------- */

export async function addBrandAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const name = String(formData.get("name") ?? "");
  const result = addBrand(name);
  revalidatePath("/dashboard/settings");
  if ("error" in result) {
    redirect(`/dashboard/settings?brand=exists`);
  }
  redirect(`/dashboard/settings?brand=added`);
}

export async function removeBrandAction(name: string): Promise<void> {
  await requireAdmin();
  removeBrand(name);
  revalidatePath("/dashboard/settings");
}

/* ---------- Store settings (bank transfer details) ---------- */

export async function updateSettingsAction(formData: FormData): Promise<void> {
  await requireAdmin();
  saveSettings({
    bankName: String(formData.get("bankName") ?? "").trim(),
    accountName: String(formData.get("accountName") ?? "").trim(),
    accountNumber: String(formData.get("accountNumber") ?? "").trim(),
    swift: String(formData.get("swift") ?? "").trim(),
  });
  revalidatePath("/dashboard/settings");
  revalidatePath("/checkout");
  redirect("/dashboard/settings?settings=saved");
}

/* ---------- Reviews ---------- */

/** Customer-facing: submit a review from the product page (pending until approved). */
export async function submitReviewAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  const productId = String(formData.get("productId") ?? "");
  if (!user) redirect(`/login?from=${encodeURIComponent(`/products/${productId}`)}`);

  const rating = Number(formData.get("rating") ?? 0);
  const text = String(formData.get("text") ?? "").trim();
  if (!productId || !text || rating < 1 || rating > 5) {
    redirect(`/products/${productId}?review=invalid`);
  }

  createReview({
    productId,
    userId: user.id,
    userName: user.name,
    rating,
    text,
  });
  revalidatePath(`/products/${productId}`);
  revalidatePath("/dashboard/reviews");
  redirect(`/products/${productId}?review=submitted`);
}

export async function approveReviewAction(id: string): Promise<void> {
  await requireAdmin();
  const review = setReviewStatus(id, "approved");
  revalidatePath("/dashboard/reviews");
  if (review) revalidatePath(`/products/${review.productId}`);
}

export async function deleteReviewAction(id: string): Promise<void> {
  await requireAdmin();
  deleteReview(id);
  revalidatePath("/dashboard/reviews");
}
