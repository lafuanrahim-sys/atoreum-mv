"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { updateOrderStatus } from "@/lib/data/orders.server";
import { getCurrentUser } from "@/lib/auth/currentUser.server";
import { isAdminRole } from "@/lib/auth/userSession";
import type { OrderStatus } from "@/lib/types";

export async function changeOrderStatus(orderId: string, status: OrderStatus) {
  // Server actions are public endpoints — role-check inside, not just at the page.
  const user = await getCurrentUser();
  if (!user || !isAdminRole(user.role)) redirect("/login");

  updateOrderStatus(orderId, status);
  revalidatePath("/dashboard/orders");
  revalidatePath(`/dashboard/orders/${orderId}`);
  revalidatePath("/dashboard/preorders");
  revalidatePath("/dashboard");
  // Customers see status (and gain review rights on completion) on these.
  revalidatePath("/account");
}
