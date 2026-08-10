import type { Metadata } from "next";
import ContactClient from "@/components/contact/ContactClient";

export const metadata: Metadata = {
  title: "Contact | Atoreum MV",
  description: "Get in touch with Atoreum MV: call, email, or send us a note.",
};

/**
 * Server shell: reads the sent/error flags from the redirect and hands off
 * to the interactive "note to Malé" composition (see ContactClient).
 */
export default async function ContactPage({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string; error?: string }>;
}) {
  const { sent = "", error = "" } = await searchParams;
  return <ContactClient sent={!!sent} error={!!error} />;
}
