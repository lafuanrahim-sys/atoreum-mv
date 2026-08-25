/**
 * Where an order came from.
 *
 * One list, used by the form that records a sale, the badge that displays it,
 * and the type that carries it. Adding a channel here adds it everywhere; a
 * second copy in the form's markup is how the picker and the database drift
 * until one of them refuses a value the other offers.
 *
 * 'manual' is not offered anywhere. It exists because orders were entered with
 * it before channels were recorded, and dropping it would make those rows
 * unreadable rather than merely unspecific.
 */
export const ORDER_CHANNELS = [
  { value: "instagram", label: "Instagram" },
  { value: "facebook", label: "Facebook" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "viber", label: "Viber" },
  { value: "phone", label: "Phone call" },
  { value: "walk-in", label: "In person" },
  { value: "other", label: "Somewhere else" },
] as const;

export type OrderChannel = (typeof ORDER_CHANNELS)[number]["value"];

/** Every value the column accepts, including the ones not offered in the form. */
export type OrderSource = OrderChannel | "web" | "manual";

const LABELS: Record<string, string> = {
  ...Object.fromEntries(ORDER_CHANNELS.map((c) => [c.value, c.label])),
  web: "Website",
  manual: "Entered by hand",
};

export function channelLabel(source: string | null | undefined): string {
  return LABELS[source ?? "web"] ?? "Website";
}

/** True for anything a person typed in rather than a customer placing it. */
export function isManualSource(source: string | null | undefined): boolean {
  return Boolean(source) && source !== "web";
}
