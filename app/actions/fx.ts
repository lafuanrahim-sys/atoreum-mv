"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/currentUser.server";
import { isAdminRole } from "@/lib/auth/userSession";
import {
  createFxExchange,
  createFxTtPayment,
  deleteFxExchange,
  deleteFxTtPayment,
  saveFxSettings,
  updateFxExchange,
  updateFxTtPayment,
} from "@/lib/data/fx.server";

/** Server actions are public endpoints — role-check inside, not just at the page. */
async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user || !isAdminRole(user.role)) redirect("/login");
  return user;
}

function readNumber(formData: FormData, name: string): number {
  const value = Number(formData.get(name));
  return Number.isFinite(value) ? value : 0;
}

function readOptionalNumber(formData: FormData, name: string): number | null {
  const raw = String(formData.get(name) ?? "").trim();
  if (!raw) return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

/* --------------------------------- settings -------------------------------- */

export async function updateFxSettingsAction(formData: FormData): Promise<void> {
  const user = await requireAdmin();
  await saveFxSettings({
    ceilingRate: readNumber(formData, "ceilingRate"),
    bankTtRate: readNumber(formData, "bankTtRate"),
    latestMarketRate: readNumber(formData, "latestMarketRate"),
    updatedBy: user.name,
  });
  revalidatePath("/fx");
  revalidatePath("/fx/settings");
  revalidatePath("/fx/exchange/new");
  revalidatePath("/fx/tt/new");
  redirect("/fx/settings?saved=1");
}

/* --------------------------------- exchanges -------------------------------- */

function readExchangeFields(formData: FormData) {
  return {
    tradeDate: String(formData.get("tradeDate") ?? ""),
    counterparty: String(formData.get("counterparty") ?? "").trim(),
    usdAmount: readNumber(formData, "usdAmount"),
    buyRate: readNumber(formData, "buyRate"),
    marketRate: readNumber(formData, "marketRate"),
    ceilingRate: readNumber(formData, "ceilingRate"),
    sellRate: readOptionalNumber(formData, "sellRate"),
    notes: String(formData.get("notes") ?? "").trim(),
  };
}

export async function createFxExchangeAction(formData: FormData): Promise<void> {
  const user = await requireAdmin();
  const fields = readExchangeFields(formData);
  if (!fields.tradeDate || !fields.counterparty || fields.usdAmount <= 0 || fields.buyRate <= 0 || fields.marketRate <= 0) {
    throw new Error("Date, counterparty, USD amount, rate you paid, and today's market rate are required.");
  }
  await createFxExchange({ ...fields, createdBy: user.name });
  revalidatePath("/fx");
  revalidatePath("/fx/exchange");
  redirect("/fx/exchange");
}

export async function updateFxExchangeAction(id: string, formData: FormData): Promise<void> {
  await requireAdmin();
  const fields = readExchangeFields(formData);
  if (!fields.tradeDate || !fields.counterparty || fields.usdAmount <= 0 || fields.buyRate <= 0 || fields.marketRate <= 0) {
    throw new Error("Date, counterparty, USD amount, rate you paid, and today's market rate are required.");
  }
  await updateFxExchange(id, fields);
  revalidatePath("/fx");
  revalidatePath("/fx/exchange");
  revalidatePath(`/fx/exchange/${id}/edit`);
  redirect("/fx/exchange");
}

export async function deleteFxExchangeAction(id: string): Promise<void> {
  await requireAdmin();
  await deleteFxExchange(id);
  revalidatePath("/fx");
  revalidatePath("/fx/exchange");
}

/* ------------------------------- TT payments -------------------------------- */

function readTtFields(formData: FormData) {
  // The form takes a percentage (e.g. "49.9853") for readability -- stored
  // as the fraction the generated columns expect (0.499853).
  const supportPctInput = readNumber(formData, "supportPct");
  return {
    ttDate: String(formData.get("ttDate") ?? ""),
    reference: String(formData.get("reference") ?? "").trim(),
    purpose: String(formData.get("purpose") ?? "").trim(),
    ttAmount: readNumber(formData, "ttAmount"),
    supportPct: supportPctInput / 100,
    bankRate: readNumber(formData, "bankRate"),
    marketRate: readNumber(formData, "marketRate"),
    notes: String(formData.get("notes") ?? "").trim(),
  };
}

export async function createFxTtAction(formData: FormData): Promise<void> {
  const user = await requireAdmin();
  const fields = readTtFields(formData);
  if (
    !fields.ttDate ||
    !fields.reference ||
    fields.ttAmount <= 0 ||
    fields.supportPct < 0 ||
    fields.supportPct > 1 ||
    fields.bankRate <= 0 ||
    fields.marketRate <= 0
  ) {
    throw new Error("Date, reference, TT amount, a support share between 0-100%, bank rate, and market rate are required.");
  }
  await createFxTtPayment({ ...fields, createdBy: user.name });
  revalidatePath("/fx");
  revalidatePath("/fx/tt");
  redirect("/fx/tt");
}

export async function updateFxTtAction(id: string, formData: FormData): Promise<void> {
  await requireAdmin();
  const fields = readTtFields(formData);
  if (
    !fields.ttDate ||
    !fields.reference ||
    fields.ttAmount <= 0 ||
    fields.supportPct < 0 ||
    fields.supportPct > 1 ||
    fields.bankRate <= 0 ||
    fields.marketRate <= 0
  ) {
    throw new Error("Date, reference, TT amount, a support share between 0-100%, bank rate, and market rate are required.");
  }
  await updateFxTtPayment(id, fields);
  revalidatePath("/fx");
  revalidatePath("/fx/tt");
  revalidatePath(`/fx/tt/${id}/edit`);
  redirect("/fx/tt");
}

export async function deleteFxTtAction(id: string): Promise<void> {
  await requireAdmin();
  await deleteFxTtPayment(id);
  revalidatePath("/fx");
  revalidatePath("/fx/tt");
}
