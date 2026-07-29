"use client";

import { useFormStatus } from "react-dom";
import { cn } from "@/lib/utils";

const VARIANT_CLASS: Record<"solid" | "outline", string> = {
  solid: "bg-gold-deep text-ink hover:bg-gold-deep/90",
  outline: "border border-line text-ivory-dim hover:border-gold hover:text-gold",
};

function Spinner() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-3.5 w-3.5 animate-spin">
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="2" opacity="0.25" />
      <path d="M21 12a9 9 0 0 0-9-9" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

/**
 * Submit button that shows a spinner + pending label while its enclosing
 * form action is in flight (via useFormStatus, so it must render inside a
 * <form>). Server Actions give no other built-in signal that a submit is
 * underway -- without this a slow action (e.g. sending a verification
 * email) just leaves the button looking inert.
 */
export default function SubmitButton({
  children,
  pendingLabel,
  variant = "solid",
  className,
}: {
  children: React.ReactNode;
  pendingLabel?: React.ReactNode;
  variant?: "solid" | "outline";
  className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={cn(
        "flex items-center justify-center gap-2 px-6 py-3 text-xs uppercase tracking-[0.2em] transition-all duration-150 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-70 disabled:active:scale-100",
        VARIANT_CLASS[variant],
        className
      )}
    >
      {pending && <Spinner />}
      {pending && pendingLabel ? pendingLabel : children}
    </button>
  );
}
