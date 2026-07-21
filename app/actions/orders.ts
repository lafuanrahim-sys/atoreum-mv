"use server";

import { revalidatePath } from "next/cache";
import { updateOrderStatus } from "@/lib/data/orders.server";
import type { OrderStatus } from "@/lib/types";

export async function changeOrderStatus(orderId: string, status: OrderStatus) {
  updateOrderStatus(orderId, status);
  revalidatePath("/admin/orders");
  revalidatePath(`/admin/orders/${orderId}`);
}
