"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useCart } from "@/lib/cart/CartContext";
import { submitOrder } from "@/app/actions/checkout";
import { MAX_REDEMPTION_SUBTOTAL_FRACTION, MIN_REDEMPTION_BOLI, REDEMPTION_BOLI_PER_MVR } from "@/lib/boli/config";
import type { StoreSettings } from "@/lib/data/settings.server";
import type { PaymentMethod } from "@/lib/types";

export type BoliEligibility = { available: number; eligible: boolean; ineligibleReason: string | null } | null;

function formatPrice(price: number, currency: string) {
  return `${currency} ${price.toLocaleString("en-US")}`;
}

const MAX_PROOF_BYTES = 8 * 1024 * 1024;
// Broad on purpose: bank-app screenshots arrive as JPG/PNG/WEBP on most
// phones but as HEIC/HEIF on iPhones — those were greyed out in the file
// picker before, which read as "upload is broken" with no explanation.
const PROOF_ACCEPT = "image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif,application/pdf";

function formatBytes(bytes: number) {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

/** Client-side mirror of the server's checks so problems surface on
 *  selection, not after a full submit round-trip. Returns an error or null. */
function validateProof(file: File): string | null {
  if (file.size > MAX_PROOF_BYTES) {
    return `That file is ${formatBytes(file.size)}. The limit is 8 MB. Try a screenshot instead of a full-resolution photo.`;
  }
  const okType =
    ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif", "application/pdf"].includes(file.type) ||
    /\.(jpe?g|png|webp|heic|heif|pdf)$/i.test(file.name);
  if (!okType) {
    return "That file type isn't supported. Please upload a photo (JPG, PNG, WEBP, HEIC) or a PDF.";
  }
  return null;
}

type Step = "shipping" | "review" | "payment";

const STEPS: { key: Step; label: string }[] = [
  { key: "shipping", label: "Shipping" },
  { key: "review", label: "Review" },
  { key: "payment", label: "Payment" },
];

export default function CheckoutClient({
  bankDetails,
  boli,
  defaultContact,
}: {
  bankDetails: StoreSettings;
  /** Signed-in user's Sangu redemption eligibility, resolved server-side — null for guests. This only drives whether the widget is shown; the actual redemption is re-validated server-side regardless (see app/actions/checkout.ts). */
  boli: BoliEligibility;
  /** Signed-in user's name/email, prefilled so it naturally matches the account instead of relying on the customer retyping it correctly — null for guests. Still just a starting point; the account link itself comes from the session server-side (app/actions/checkout.ts), not from this value matching. */
  defaultContact: { name: string; email: string } | null;
}) {
  const { lines, subtotal, currency, clearCart } = useCart();
  const router = useRouter();

  const [step, setStep] = useState<Step>("shipping");
  const [contact, setContact] = useState({
    name: defaultContact?.name ?? "",
    email: defaultContact?.email ?? "",
    phone: "",
    address: "",
  });
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("transfer");
  const [boliInput, setBoliInput] = useState("");
  // Held in React state rather than left in the <input type="file"> DOM node:
  // React 19 resets uncontrolled form fields after a server action returns,
  // which silently wiped the chosen file whenever submission failed — the
  // user saw "No file chosen" again with no idea why.
  const [proofFile, setProofFile] = useState<File | null>(null);
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

  // Live preview only — the server re-validates every part of this against
  // the real Sangu balance and re-computes the cap itself (spec §6.4, "never
  // trust the client"). Safe to import config here since lib/boli/config.ts
  // is pure data with no runtime imports.
  const maxByCapSangu = Math.floor(subtotal * MAX_REDEMPTION_SUBTOTAL_FRACTION * REDEMPTION_BOLI_PER_MVR);
  const maxRedeemableSangu = boli ? Math.min(boli.available, maxByCapSangu) : 0;
  const boliRequested = Math.max(0, Math.floor(Number(boliInput) || 0));
  const boliApplied = Math.min(boliRequested, maxRedeemableSangu);
  const boliMeetsMinimum = boliApplied >= MIN_REDEMPTION_BOLI;
  const boliDiscountMvr = boliMeetsMinimum ? boliApplied / REDEMPTION_BOLI_PER_MVR : 0;
  const total = Math.max(0, subtotal - boliDiscountMvr);

  if (lines.length === 0) {
    return (
      <div className="page-gutter bg-ink pt-10 pb-28 text-center md:pt-14">
        <p className="text-ivory-dim">Your cart is empty.</p>
        <Link href="/products" className="mt-6 inline-block text-gold underline">
          Continue shopping
        </Link>
      </div>
    );
  }

  const handleSubmit = async (formData: FormData) => {
    setError(null);

    if (paymentMethod === "transfer") {
      if (!proofFile) {
        setError("Please attach your transfer receipt before placing the order.");
        return;
      }
      const proofError = validateProof(proofFile);
      if (proofError) {
        setError(proofError);
        return;
      }
      formData.set("paymentProof", proofFile);
    }

    setSubmitting(true);
    try {
      const result = await submitOrder(formData);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      clearCart();
      router.push(`/order-confirmation/${result.orderId}?t=${result.accessToken}`);
    } catch {
      // Network / transport failure (offline, request too large, timeout) —
      // without this the rejection left the button stuck on "Placing Order…".
      setError("We couldn't reach the server. Check your connection and try again. Your details are still filled in.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="page-gutter bg-ink pt-10 pb-28 md:pt-14">
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
          <input type="hidden" name="paymentMethod" value={paymentMethod} />
          {/* Omitted entirely (not just zero) unless the amount clears the minimum — an absent field reads server-side as "no redemption requested" rather than a rejected tiny one. */}
          {boliMeetsMinimum && <input type="hidden" name="boliRedeem" value={boliApplied} />}

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
                className="mt-4 self-start bg-gold-deep px-8 py-4 text-xs uppercase tracking-[0.2em] text-ink transition-colors hover:bg-gold-deep/90 disabled:cursor-not-allowed disabled:opacity-40"
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
                    <span className="text-ivory-dim tabular-nums">
                      {formatPrice(line.price * line.quantity, line.currency)}
                    </span>
                  </li>
                ))}
              </ul>
              <div className="flex justify-between pt-6 text-base">
                <span className="text-ivory">Subtotal</span>
                <span className="text-ivory tabular-nums">{formatPrice(subtotal, currency ?? "MVR")}</span>
              </div>

              <BoliRedeemWidget
                boli={boli}
                subtotal={subtotal}
                currency={currency ?? "MVR"}
                maxRedeemableSangu={maxRedeemableSangu}
                input={boliInput}
                onInputChange={setBoliInput}
                applied={boliApplied}
                meetsMinimum={boliMeetsMinimum}
                discountMvr={boliDiscountMvr}
              />

              {boliMeetsMinimum && (
                <div className="mt-4 flex justify-between text-base">
                  <span className="text-ivory">Total after Sangu</span>
                  <span className="text-gold tabular-nums">{formatPrice(total, currency ?? "MVR")}</span>
                </div>
              )}

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
                  className="bg-gold-deep px-8 py-4 text-xs uppercase tracking-[0.2em] text-ink transition-colors hover:bg-gold-deep/90"
                >
                  Continue to Payment
                </button>
              </div>
            </div>
          )}

          {step === "payment" && (
            <PaymentStep
              bankDetails={bankDetails}
              method={paymentMethod}
              onMethodChange={setPaymentMethod}
              proofFile={proofFile}
              onProofChange={(f) => {
                setProofFile(f);
                setError(null); // a stale "attach your receipt" error shouldn't outlive the attach
              }}
              onBack={() => setStep("review")}
              submitting={submitting}
              error={error}
              total={total}
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

/**
 * Redemption widget shown in the Review step. Purely a live preview and
 * convenience UI — every number here is re-derived and re-validated
 * server-side in app/actions/checkout.ts / lib/boli/ledger.server.ts
 * regardless of what this component sends.
 */
function BoliRedeemWidget({
  boli,
  currency,
  maxRedeemableSangu,
  input,
  onInputChange,
  applied,
  meetsMinimum,
  discountMvr,
}: {
  boli: BoliEligibility;
  subtotal: number;
  currency: string;
  maxRedeemableSangu: number;
  input: string;
  onInputChange: (v: string) => void;
  applied: number;
  meetsMinimum: boolean;
  discountMvr: number;
}) {
  if (!boli) return null; // guest checkout — Sangu is account-only

  if (!boli.eligible) {
    return (
      <p className="mt-6 text-xs text-ivory-dim">
        {boli.ineligibleReason ?? "Sangu redemption isn't available on this account yet."}
      </p>
    );
  }

  const requestedButBelowMinimum = input.trim() !== "" && Number(input) > 0 && !meetsMinimum;

  return (
    <div className="mt-6 border border-line p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-xs uppercase tracking-[0.15em] text-gold">Redeem Sangu</p>
        <p className="text-xs text-ivory-dim">{boli.available.toLocaleString()} Sangu available</p>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <input
          type="number"
          inputMode="numeric"
          min={0}
          max={maxRedeemableSangu}
          step={1}
          value={input}
          onChange={(e) => onInputChange(e.target.value)}
          placeholder="0"
          aria-label="Sangu to redeem"
          className="w-32 border border-line bg-transparent px-3 py-2 text-sm text-ivory focus:border-gold focus:outline-none"
        />
        <button
          type="button"
          onClick={() => onInputChange(String(maxRedeemableSangu))}
          className="text-xs uppercase tracking-[0.15em] text-gold underline underline-offset-4"
        >
          Use max ({maxRedeemableSangu.toLocaleString()})
        </button>
      </div>

      <p className="mt-2 text-xs text-ivory-dim">
        Minimum {MIN_REDEMPTION_BOLI.toLocaleString()} Sangu · up to {Math.round(MAX_REDEMPTION_SUBTOTAL_FRACTION * 100)}% of
        this order&apos;s subtotal
      </p>

      {requestedButBelowMinimum && (
        <p className="mt-2 text-xs text-red-400">
          Enter at least {MIN_REDEMPTION_BOLI.toLocaleString()} Sangu, or clear the field.
        </p>
      )}

      {meetsMinimum && (
        <p className="mt-3 flex items-center gap-1.5 text-sm text-gold">
          <svg viewBox="0 0 16 16" aria-hidden="true" className="h-3.5 w-3.5">
            <path d="M3 8.5l3.2 3.2L13 4.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {applied.toLocaleString()} Sangu applied · {formatPrice(discountMvr, currency)} off
        </p>
      )}
    </div>
  );
}

function PaymentStep({
  bankDetails,
  method,
  onMethodChange,
  proofFile,
  onProofChange,
  onBack,
  submitting,
  error,
  total,
  currency,
}: {
  bankDetails: StoreSettings;
  method: PaymentMethod;
  onMethodChange: (m: PaymentMethod) => void;
  proofFile: File | null;
  onProofChange: (f: File | null) => void;
  onBack: () => void;
  submitting: boolean;
  error: string | null;
  total: number;
  currency: string;
}) {
  const METHODS: { key: PaymentMethod; label: string; hint: string }[] = [
    { key: "transfer", label: "Bank Transfer", hint: "Pay now and upload your receipt" },
    { key: "cash", label: "Cash", hint: "Pay in cash when your order is delivered" },
  ];

  return (
    <div>
      <fieldset>
        <legend className="text-xs uppercase tracking-[0.15em] text-ivory">Payment method</legend>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {METHODS.map((m) => (
            <label
              key={m.key}
              className={`flex cursor-pointer flex-col gap-1 border p-4 transition-colors ${
                method === m.key ? "border-gold" : "border-line hover:border-ivory-dim"
              }`}
            >
              <span className="flex items-center gap-2">
                <input
                  type="radio"
                  name="paymentMethodChoice"
                  checked={method === m.key}
                  onChange={() => onMethodChange(m.key)}
                  className="accent-[var(--gold)]"
                />
                <span className="text-sm text-ivory">{m.label}</span>
              </span>
              <span className="text-xs text-ivory-dim">{m.hint}</span>
            </label>
          ))}
        </div>
      </fieldset>

      {method === "transfer" ? (
        <>
          <div className="mt-6 border border-line p-6">
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

          <ProofUpload file={proofFile} onChange={onProofChange} />
        </>
      ) : (
        <div className="mt-6 border border-line p-6 text-sm leading-relaxed text-ivory-dim">
          <p>
            You&apos;ll pay <span className="text-ivory">{formatPrice(total, currency)}</span> in
            cash when your order is delivered. No payment is needed now.
          </p>
          <p className="mt-3 flex items-start gap-2 text-gold">
            <svg viewBox="0 0 16 16" aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0">
              <circle cx="8" cy="8" r="6.5" fill="none" stroke="currentColor" strokeWidth="1.2" />
              <path d="M8 5v3.5M8 10.8v.7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
            </svg>
            Please have the exact amount ready before delivery. Our courier may not carry change.
          </p>
        </div>
      )}

      {error && (
        <p role="alert" className="mt-4 flex items-start gap-2 text-sm text-red-400">
          <svg viewBox="0 0 16 16" aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0">
            <circle cx="8" cy="8" r="6.5" fill="none" stroke="currentColor" strokeWidth="1.2" />
            <path d="M8 5v3.5M8 10.8v.7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
          </svg>
          {error}
        </p>
      )}

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
          className="bg-gold-deep px-8 py-4 text-xs uppercase tracking-[0.2em] text-ink transition-colors hover:bg-gold-deep/90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? "Placing Order…" : "Place Order"}
        </button>
      </div>
    </div>
  );
}

function ProofUpload({
  file,
  onChange,
}: {
  file: File | null;
  onChange: (f: File | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  const takeFile = (next: File | undefined) => {
    if (!next) return;
    const validationError = validateProof(next);
    setFileError(validationError);
    if (validationError) return;
    onChange(next);
    if (preview) URL.revokeObjectURL(preview);
    // PDFs and HEIC don't render in <img>; only preview browser-displayable types.
    setPreview(
      ["image/jpeg", "image/png", "image/webp"].includes(next.type)
        ? URL.createObjectURL(next)
        : null
    );
  };

  const clearFile = () => {
    onChange(null);
    setFileError(null);
    if (preview) URL.revokeObjectURL(preview);
    setPreview(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <div className="mt-6 flex flex-col gap-2">
      <span id="proof-label" className="text-xs uppercase tracking-[0.15em] text-ivory-dim">
        Proof of payment (required)
      </span>

      <input
        ref={inputRef}
        type="file"
        accept={PROOF_ACCEPT}
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(e) => takeFile(e.target.files?.[0])}
      />

      {file ? (
        <div className="flex items-center gap-4 border border-line p-4">
          {preview ? (
            // Plain <img>: the source is a local blob URL, next/image can't optimize it.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="" className="h-14 w-14 shrink-0 rounded-sm object-cover" />
          ) : (
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-sm bg-ink-2 text-gold">
              <svg viewBox="0 0 20 20" aria-hidden="true" className="h-6 w-6">
                <path d="M5 2h7l4 4v12H5z" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
                <path d="M12 2v4h4" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
              </svg>
            </span>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm text-ivory">{file.name}</p>
            <p className="mt-0.5 flex items-center gap-1.5 text-xs text-gold">
              <svg viewBox="0 0 12 12" aria-hidden="true" className="h-3 w-3">
                <path d="M2 6.5L4.8 9 10 3.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              {formatBytes(file.size)} · attached
            </p>
          </div>
          <button
            type="button"
            onClick={clearFile}
            className="min-h-11 shrink-0 border border-line px-4 text-[10px] uppercase tracking-[0.2em] text-ivory-dim transition-colors hover:border-gold hover:text-gold"
          >
            Remove
          </button>
        </div>
      ) : (
        <button
          type="button"
          aria-labelledby="proof-label"
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            takeFile(e.dataTransfer.files?.[0]);
          }}
          className={`flex min-h-28 w-full cursor-pointer flex-col items-center justify-center gap-2 border border-dashed px-6 py-6 text-center transition-colors focus:border-gold focus:outline-none ${
            dragOver ? "border-gold bg-gold/5" : "border-line hover:border-ivory-dim"
          }`}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true" className="h-6 w-6 text-gold">
            <path d="M12 15V4m0 0L8 8m4-4l4 4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M4 15v3a2 2 0 002 2h12a2 2 0 002-2v-3" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <span className="text-sm text-ivory">
            Drop your receipt here, or <span className="text-gold underline underline-offset-4">browse</span>
          </span>
          <span className="text-xs text-ivory-dim">
            Screenshot or photo of the transfer: JPG, PNG, WEBP, HEIC, or PDF, up to 8 MB
          </span>
        </button>
      )}

      {fileError && (
        <p role="alert" className="flex items-start gap-2 text-sm text-red-400">
          <svg viewBox="0 0 16 16" aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0">
            <circle cx="8" cy="8" r="6.5" fill="none" stroke="currentColor" strokeWidth="1.2" />
            <path d="M8 5v3.5M8 10.8v.7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
          </svg>
          {fileError}
        </p>
      )}
    </div>
  );
}
