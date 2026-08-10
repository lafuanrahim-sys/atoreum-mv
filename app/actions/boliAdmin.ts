"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/currentUser.server";
import { isAdminRole } from "@/lib/auth/userSession";
import { resolveFraudFlag, unsuspendGameAccess } from "@/lib/boli/fraud.server";
import { adminAdjustment } from "@/lib/boli/ledger.server";
import { setRuntimeConfig, clearRuntimeConfig, type RuntimeConfigKey } from "@/lib/boli/runtimeConfig.server";
import { ADMIN_ADJUSTMENT_APPROVAL_THRESHOLD } from "@/lib/boli/config";

async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user || !isAdminRole(user.role)) redirect("/login");
  return user;
}

export async function resolveFraudFlagAction(flagId: string, status: "resolved" | "dismissed") {
  const admin = await requireAdmin();
  await resolveFraudFlag({ flagId, adminId: admin.id, status });
  revalidatePath("/dashboard/boli");
}

export async function unsuspendGameAccessAction(userId: string) {
  await requireAdmin();
  await unsuspendGameAccess(userId);
  revalidatePath("/dashboard/boli");
}

/** Manual balance adjustment from the admin dashboard — always attributed, always a reason (BOLI_SPEC.md §6.6). */
export async function adminAdjustBalanceAction(userId: string, delta: number, reason: string) {
  const admin = await requireAdmin();
  if (!Number.isInteger(delta) || delta === 0) throw new Error("Adjustment must be a non-zero whole number of Sangu.");
  if (Math.abs(delta) > ADMIN_ADJUSTMENT_APPROVAL_THRESHOLD) {
    throw new Error(
      `Adjustments over ${ADMIN_ADJUSTMENT_APPROVAL_THRESHOLD.toLocaleString()} Sangu need a second admin. Split this into smaller adjustments.`
    );
  }
  await adminAdjustment({ userId, delta: BigInt(delta), adminId: admin.id, reason });
  revalidatePath("/dashboard/boli");
  // Sangu is shown and adjusted from the customers pages too, so both have to
  // re-render or the balance there stays stale after an adjustment.
  revalidatePath("/dashboard/customers");
  revalidatePath(`/dashboard/customers/${userId}`);
}

export async function setRuntimeConfigAction(key: RuntimeConfigKey, value: boolean | number) {
  const admin = await requireAdmin();
  await setRuntimeConfig(key, value, admin.id);
  revalidatePath("/dashboard/boli");
}

export async function clearRuntimeConfigAction(key: RuntimeConfigKey) {
  await requireAdmin();
  await clearRuntimeConfig(key);
  revalidatePath("/dashboard/boli");
}
