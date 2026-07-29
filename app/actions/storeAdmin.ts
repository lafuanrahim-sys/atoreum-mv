"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/currentUser.server";
import { isAdminRole } from "@/lib/auth/userSession";
import { addBrand, removeBrand } from "@/lib/data/brands.server";
import { hasCompletedPurchase } from "@/lib/data/orders.server";
import { getSettings, saveSettings, setMaintenanceMode } from "@/lib/data/settings.server";
import {
  createReview,
  deleteReview,
  setReviewStatus,
} from "@/lib/data/reviews.server";

async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user || !isAdminRole(user.role)) redirect("/login");
  return user;
}

/* ---------- Dashboard appearance ---------- */

// Cookie name is duplicated in app/dashboard/layout.tsx — a "use server"
// file may only export async functions, so the constant can't live here.
const DASHBOARD_THEME_COOKIE = "atoreum_dashboard_theme";

/** Flip the admin portal between its light and dark palette. */
export async function toggleDashboardThemeAction(): Promise<void> {
  await requireAdmin();
  const cookieStore = await cookies();
  const current = cookieStore.get(DASHBOARD_THEME_COOKIE)?.value;
  cookieStore.set(DASHBOARD_THEME_COOKIE, current === "dark" ? "light" : "dark", {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });
  revalidatePath("/dashboard", "layout");
}

/* ---------- Brands (Dashboard → Settings) ---------- */

export async function addBrandAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const name = String(formData.get("name") ?? "");
  const result = await addBrand(name);
  revalidatePath("/dashboard/settings");
  if ("error" in result) {
    redirect(`/dashboard/settings?brand=exists`);
  }
  redirect(`/dashboard/settings?brand=added`);
}

export async function removeBrandAction(name: string): Promise<void> {
  await requireAdmin();
  await removeBrand(name);
  revalidatePath("/dashboard/settings");
}

/* ---------- Store settings (bank transfer details) ---------- */

export async function updateSettingsAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const current = await getSettings();
  await saveSettings({
    ...current,
    bankName: String(formData.get("bankName") ?? "").trim(),
    accountName: String(formData.get("accountName") ?? "").trim(),
    accountNumber: String(formData.get("accountNumber") ?? "").trim(),
    swift: String(formData.get("swift") ?? "").trim(),
  });
  revalidatePath("/dashboard/settings");
  revalidatePath("/checkout");
  redirect("/dashboard/settings?settings=saved");
}

/* ---------- Maintenance mode ---------- */

/**
 * Site-wide on/off switch (see app/layout.tsx) -- while enabled, every
 * visitor except a signed-in admin sees a "closed for maintenance" page
 * instead of the storefront. Toggled from Dashboard -> Settings, takes
 * effect within a few seconds (the flag is read with a short cache, not
 * live on every request -- see the unstable_cache wrapper in layout.tsx).
 */
export async function toggleMaintenanceModeAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const enabled = formData.get("maintenanceMode") === "on";
  await setMaintenanceMode(enabled);
  revalidatePath("/", "layout");
  revalidatePath("/dashboard/settings");
  redirect(`/dashboard/settings?maintenance=${enabled ? "on" : "off"}`);
}

/* ---------- Reviews ---------- */

/**
 * Customer-facing: submit a review from the product page (pending until
 * approved). Only customers with a COMPLETED order containing the product
 * may review it — enforced here, not just hidden in the UI.
 */
export async function submitReviewAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  const productId = String(formData.get("productId") ?? "");
  if (!user) redirect(`/login?from=${encodeURIComponent(`/products/${productId}`)}`);

  if (!(await hasCompletedPurchase(user.email, productId))) {
    redirect(`/products/${productId}?review=not-purchased`);
  }

  const rating = Number(formData.get("rating") ?? 0);
  const text = String(formData.get("text") ?? "").trim();
  if (!productId || !text || rating < 1 || rating > 5) {
    redirect(`/products/${productId}?review=invalid`);
  }

  await createReview({
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
  const review = await setReviewStatus(id, "approved");
  revalidatePath("/dashboard/reviews");
  if (review) revalidatePath(`/products/${review.productId}`);
}

export async function deleteReviewAction(id: string): Promise<void> {
  await requireAdmin();
  await deleteReview(id);
  revalidatePath("/dashboard/reviews");
}
