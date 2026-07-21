"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useCart } from "@/lib/cart/CartContext";
import { submitOrder } from "@/app/actions/checkout";
import { bankDetails } from "@/lib/bankDetails";

function formatPrice(price: number, currency: string) {
  return `${currency} ${price.toLocaleString("en-US")}`;
}

type Step = "shipping" | "review" | "payment";

const STEPS: { key: Step; label: string }[] = [
  { key: "shipping", label: "Shipping" },
  { key: "review", label: "Review" },
  { key: "payment", label: "Payment" },
];

export default function CheckoutPage() {
  const { lines, subtotal, currency, clearCart } = useCart();
  const router = useRouter();

  const [step, setStep] = useState<Step>("shipping");
  const [contact, setContact] = useState({ name: "", email: "", phone: "", address: "" });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const stepIndex = STEPS.findIndex((s) => s.key === step);
  const contactValid = contact.name && contact.email && contact.phone && contact.address;

  const itemsJson = useMemo(
    () =>
      JSON.stringify(
        lines.map((l) => ({
          productId: l.productId,
          name: l.name,
          price: l.price,
          currency: l.currency,
          quantity: l.quantity,
          image: l.image,
        }))
      ),
    [lines]
  );

  if (lines.length === 0) {
    return (
      <div className="bg-ink px-6 pt-32 pb-28 text-center md:pt-40">
        <p className="text-ivory-dim">Your cart is empty.</p>
        <Link href="/products" className="mt-6 inline-block text-gold underline">
          Continue shopping
        </Link>
      </div>
    );
  }

  const handleSubmit = async (formData: FormData) => {
    setSubmitting(true);
    setError(null);
    const result = await submitOrder(formData);
    setSubmitting(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    clearCart();
    router.push(`/order-confirmation/${result.orderId}`);
  };

  return (
    <div className="bg-ink px-6 pt-32 pb-28 md:px-12 md:pt-40">
      <div className="mx-auto max-w-3xl">
        <h1 className="font-display text-3xl text-ivory md:text-4xl">Checkout</h1>

        <div className="mt-8 flex gap-6">
          {STEPS.map((s, i) => (
            <div
              key={s.key}
              className={`flex items-center gap-2 text-xs uppercase tracking-[0.15em] ${
                i <= stepIndex ? "text-gold" : "text-ivory-dim"
              }`}
            >
              <span className="flex h-6 w-6 items-center justify-center rounded-full border border-current text-[10px]">
                {i + 1}
              </span>
              {s.label}
            </div>
          ))}
        </div>

        <form action={handleSubmit} className="mt-10">
          <input type="hidden" name="items" value={itemsJson} />
          <input type="hidden" name="name" value={contact.name} />
          <input type="hidden" name="email" value={contact.email} />
          <input type="hidden" name="phone" value={contact.phone} />
          <input type="hidden" name="address" value={contact.address} />

          {step === "shipping" && (
            <div className="flex flex-col gap-5">
              <Field
                label="Full name"
                value={contact.name}
                onChange={(v) => setContact((c) => ({ ...c, name: v }))}
              />
              <Field
                label="Email"
                type="email"
                value={contact.email}
                onChange={(v) => setContact((c) => ({ ...c, email: v }))}
              />
              <Field
                label="Phone"
                type="tel"
                value={contact.phone}
                onChange={(v) => setContact((c) => ({ ...c, phone: v }))}
              />
              <Field
                label="Delivery address"
                textarea
                value={contact.address}
                onChange={(v) => setContact((c) => ({ ...c, address: v }))}
              />

              <button
                type="button"
                disabled={!contactValid}
                onClick={() => setStep("review")}
                className="mt-4 self-start bg-gold px-8 py-4 text-xs uppercase tracking-[0.2em] text-ink transition-colors hover:bg-gold/90 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Continue to Review
              </button>
            </div>
          )}

          {step === "review" && (
            <div>
              <ul className="flex flex-col gap-4 border-b border-line pb-6">
                {lines.map((line) => (
                  <li key={line.productId} className="flex justify-between text-sm">
                    <span className="text-ivory">
                      {line.name} <span className="text-ivory-dim">× {line.quantity}</span>
                    </span>
                    <span className="text-ivory-dim">
                      {formatPrice(line.price * line.quantity, line.currency)}
                    </span>
                  </li>
                ))}
              </ul>
              <div className="flex justify-between pt-6 text-base">
                <span className="text-ivory">Subtotal</span>
                <span className="text-ivory">{formatPrice(subtotal, currency ?? "MVR")}</span>
              </div>

              <div className="mt-8 border-t border-line pt-6 text-sm text-ivory-dim">
                <p className="uppercase tracking-[0.15em] text-ivory">Deliver to</p>
                <p className="mt-2">{contact.name}</p>
                <p>{contact.address}</p>
                <p>{contact.phone} · {contact.email}</p>
              </div>

              <div className="mt-8 flex gap-4">
                <button
                  type="button"
                  onClick={() => setStep("shipping")}
                  className="border border-line px-6 py-4 text-xs uppercase tracking-[0.2em] text-ivory-dim hover:text-gold"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={() => setStep("payment")}
                  className="bg-gold px-8 py-4 text-xs uppercase tracking-[0.2em] text-ink transition-colors hover:bg-gold/90"
                >
                  Continue to Payment
                </button>
              </div>
            </div>
          )}

          {step === "payment" && (
            <PaymentStep
              onBack={() => setStep("review")}
              submitting={submitting}
              error={error}
              total={subtotal}
              currency={currency ?? "MVR"}
            />
          )}
        </form>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  textarea = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  textarea?: boolean;
}) {
  return (
    <label className="flex flex-col gap-2">
      <span className="text-xs uppercase tracking-[0.15em] text-ivory-dim">{label}</span>
      {textarea ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={3}
          className="border border-line bg-transparent px-4 py-3 text-sm text-ivory focus:border-gold focus:outline-none"
        />
      ) : (
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="border border-line bg-transparent px-4 py-3 text-sm text-ivory focus:border-gold focus:outline-none"
        />
      )}
    </label>
  );
}

function PaymentStep({
  onBack,
  submitting,
  error,
  total,
  currency,
}: {
  onBack: () => void;
  submitting: boolean;
  error: string | null;
  total: number;
  currency: string;
}) {
  return (
    <div>
      <div className="border border-line p-6">
        <p className="text-xs uppercase tracking-[0.15em] text-gold">Bank Transfer Details</p>
        <dl className="mt-4 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-ivory-dim">Bank</dt>
            <dd className="text-ivory">{bankDetails.bankName}</dd>
          </div>
          <div>
            <dt className="text-ivory-dim">Account Name</dt>
            <dd className="text-ivory">{bankDetails.accountName}</dd>
          </div>
          <div>
            <dt className="text-ivory-dim">Account Number</dt>
            <dd className="text-ivory">{bankDetails.accountNumber}</dd>
          </div>
          <div>
            <dt className="text-ivory-dim">SWIFT</dt>
            <dd className="text-ivory">{bankDetails.swift}</dd>
          </div>
        </dl>
        <p className="mt-6 text-sm leading-relaxed text-ivory-dim">
          Please transfer <span className="text-ivory">{formatPrice(total, currency)}</span> to
          the account above, then upload your receipt or screenshot below. Your order will be
          confirmed once payment is verified.
        </p>
      </div>

      <label className="mt-6 flex flex-col gap-2">
        <span className="text-xs uppercase tracking-[0.15em] text-ivory-dim">
          Proof of payment (optional now — you can transfer after submitting)
        </span>
        <input
          type="file"
          name="paymentProof"
          accept="image/jpeg,image/png,image/webp,application/pdf"
          className="border border-line bg-transparent px-4 py-3 text-sm text-ivory-dim file:mr-4 file:border-0 file:bg-gold file:px-4 file:py-2 file:text-xs file:uppercase file:tracking-[0.15em] file:text-ink"
        />
      </label>

      {error && <p className="mt-4 text-sm text-red-400">{error}</p>}

      <div className="mt-8 flex gap-4">
        <button
          type="button"
          onClick={onBack}
          className="border border-line px-6 py-4 text-xs uppercase tracking-[0.2em] text-ivory-dim hover:text-gold"
        >
          Back
        </button>
        <button
          type="submit"
          disabled={submitting}
          className="bg-gold px-8 py-4 text-xs uppercase tracking-[0.2em] text-ink transition-colors hover:bg-gold/90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? "Placing Order…" : "Place Order"}
        </button>
      </div>
    </div>
  );
}
