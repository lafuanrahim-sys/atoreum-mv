"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { purchaseVoucherAction } from "@/app/actions/vouchers";

const DENOMINATIONS = [1_000, 2_000, 5_000, 10_000];
const money = (boli: number) => `MVR ${(boli * 0.01).toLocaleString("en-US")}`;

export default function BuyVoucherForm({
  bankDetails,
  signedInName,
  signedInEmail,
}: {
  bankDetails: { bankName: string; accountName: string; accountNumber: string };
  signedInName: string;
  signedInEmail: string;
}) {
  const router = useRouter();
  const [faceValue, setFaceValue] = useState(2_000);
  const [method, setMethod] = useState<"transfer" | "cash">("transfer");
  const [proof, setProof] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const price = faceValue * 0.01;

  return (
    <form
      action={async (formData) => {
        setError(null);
        setSubmitting(true);
        formData.set("faceValueBoli", String(faceValue));
        formData.set("paymentMethod", method);
        if (proof) formData.set("paymentProof", proof);
        const result = await purchaseVoucherAction(formData);
        if (!result.ok) {
          setError(result.error);
          setSubmitting(false);
          return;
        }
        // Same reasoning as checkout: router.push doesn't await the
        // navigation, so re-enabling the button here would put it back before
        // the customer had left the page.
        router.push(`/order-confirmation/${result.orderId}?t=${result.accessToken}`);
      }}
      className="flex flex-col gap-8"
    >
      <fieldset>
        <legend className="text-xs uppercase tracking-[0.2em] text-sand">Amount</legend>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {DENOMINATIONS.map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setFaceValue(d)}
              aria-pressed={faceValue === d}
              className={`flex flex-col items-center gap-1 border px-4 py-4 transition-colors ${
                faceValue === d ? "border-gold text-gold" : "border-line text-ivory-dim hover:border-ivory-dim"
              }`}
            >
              <span className="font-display text-2xl">{money(d)}</span>
              <span className="font-mono text-[10px] tracking-[0.1em]">{d.toLocaleString("en-US")} Sangu</span>
            </button>
          ))}
        </div>
      </fieldset>

      <div className="grid gap-5 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs uppercase tracking-[0.15em] text-ivory-dim">Your name</span>
          <input name="name" required defaultValue={signedInName}
            className="border-b border-line bg-transparent px-1 py-2 text-sm text-ivory focus:border-gold focus:outline-none" />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs uppercase tracking-[0.15em] text-ivory-dim">Email</span>
          <input name="email" type="email" required defaultValue={signedInEmail}
            className="border-b border-line bg-transparent px-1 py-2 text-sm text-ivory focus:border-gold focus:outline-none" />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs uppercase tracking-[0.15em] text-ivory-dim">Phone</span>
          <input name="phone" type="tel" required
            className="border-b border-line bg-transparent px-1 py-2 text-sm text-ivory focus:border-gold focus:outline-none" />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs uppercase tracking-[0.15em] text-ivory-dim">Note (optional)</span>
          <input name="notes"
            className="border-b border-line bg-transparent px-1 py-2 text-sm text-ivory focus:border-gold focus:outline-none" />
        </label>
      </div>

      <fieldset>
        <legend className="text-xs uppercase tracking-[0.2em] text-sand">Payment</legend>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {([["transfer", "Bank Transfer"], ["cash", "Cash"]] as const).map(([key, label]) => (
            <label key={key}
              className={`flex cursor-pointer items-center gap-2 border p-4 transition-colors ${
                method === key ? "border-gold" : "border-line hover:border-ivory-dim"
              }`}>
              <input type="radio" name="methodChoice" checked={method === key}
                onChange={() => setMethod(key)} className="accent-[var(--gold)]" />
              <span className="text-sm text-ivory">{label}</span>
            </label>
          ))}
        </div>

        {method === "transfer" ? (
          <div className="mt-4 border border-line p-5 text-sm">
            <p className="text-xs uppercase tracking-[0.15em] text-gold">Bank Transfer Details</p>
            <dl className="mt-3 grid gap-2 sm:grid-cols-2">
              <div><dt className="text-ivory-dim">Bank</dt><dd className="text-ivory">{bankDetails.bankName}</dd></div>
              <div><dt className="text-ivory-dim">Account Name</dt><dd className="text-ivory">{bankDetails.accountName}</dd></div>
              <div><dt className="text-ivory-dim">Account Number</dt>
                <dd className="select-all font-mono tracking-wide text-ivory">{bankDetails.accountNumber}</dd></div>
            </dl>
            <p className="mt-4 text-ivory-dim">
              Transfer <span className="text-ivory">MVR {price.toLocaleString("en-US")}</span>, then upload your receipt.
            </p>
            <input type="file" required accept="image/*,application/pdf"
              onChange={(e) => setProof(e.target.files?.[0] ?? null)}
              className="mt-3 block w-full text-xs text-ivory-dim file:mr-3 file:border file:border-line file:bg-transparent file:px-3 file:py-2 file:font-mono file:text-[10px] file:uppercase file:tracking-[0.15em] file:text-ivory-dim" />
          </div>
        ) : (
          <p className="mt-4 border border-line p-5 text-sm leading-relaxed text-ivory-dim">
            You&apos;ll pay <span className="text-ivory">MVR {price.toLocaleString("en-US")}</span> in cash.
            The code activates once we&apos;ve received payment.
          </p>
        )}
      </fieldset>

      {/* Said plainly, because it is the one thing that surprises people:
          the code exists immediately, but it is worth nothing until paid. */}
      <p className="border-l-2 border-gold-deep pl-4 text-sm leading-relaxed text-ivory-dim">
        Your code appears under <span className="text-ivory">Account → Vouchers</span> straight away, and
        becomes spendable once we confirm your payment. Whoever you send it to can use it at checkout
        without an account. Anything unspent when it expires returns to you as Sangu.
      </p>

      {error && <p role="alert" className="text-sm text-red-400">{error}</p>}

      <button type="submit" disabled={submitting}
        className="self-start bg-gold-deep px-8 py-4 font-mono text-xs uppercase tracking-[0.2em] text-ink transition-colors hover:bg-gold-deep/90 disabled:cursor-not-allowed disabled:opacity-60">
        {submitting ? "Placing order…" : `Buy ${money(faceValue)} voucher`}
      </button>
    </form>
  );
}
