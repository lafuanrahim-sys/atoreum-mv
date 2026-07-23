import type { Metadata } from "next";
import { getSettings } from "@/lib/data/settings.server";
import CheckoutClient from "@/components/checkout/CheckoutClient";

export const metadata: Metadata = {
  title: "Checkout — Atoreum MV",
};

/**
 * Server shell: reads the store's bank-transfer settings (editable in
 * Dashboard → Settings) and hands them to the interactive checkout flow.
 */
export default function CheckoutPage() {
  return <CheckoutClient bankDetails={getSettings()} />;
}
