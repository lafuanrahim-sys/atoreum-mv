"use client";

import { useState, useTransition } from "react";
import { useToast } from "@/components/dashboard/ToastProvider";
import ConfirmDialog from "@/components/dashboard/ConfirmDialog";

// No separate "success" hue — this palette's accent (gold-deep) already
// reads as the affirmative color, so completing an order uses the same
// solid treatment as the primary action rather than a jarring bright green.
const VARIANT_CLASS: Record<string, string> = {
  default: "text-ivory-dim hover:text-gold-deep",
  danger: "text-ivory-dim hover:text-red-400",
  primary: "bg-gold-deep px-4 py-1.5 text-ink hover:bg-gold-deep/90",
  success: "bg-gold-deep px-3 py-1.5 text-ink hover:bg-gold-deep/90",
};

/**
 * Client wrapper around a directly-invocable server action (bound with any
 * ids already applied). Replaces the site's bare `<form action={...}>`
 * admin buttons with: optional confirm-before-destructive, a disabled
 * pending state, and toast feedback on completion — none of which a plain
 * form submission can express without a full extra round trip.
 */
export default function AdminActionButton({
  action,
  label,
  pendingLabel,
  toastMessage,
  confirmTitle,
  confirmMessage,
  confirmLabel = "Confirm",
  variant = "default",
  className = "",
  icon,
}: {
  action: () => Promise<void>;
  label: string;
  pendingLabel?: string;
  toastMessage?: string;
  confirmTitle?: string;
  confirmMessage?: string;
  confirmLabel?: string;
  variant?: "default" | "danger" | "primary" | "success";
  className?: string;
  icon?: React.ReactNode;
}) {
  const [isPending, startTransition] = useTransition();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const { showToast } = useToast();

  const run = () => {
    startTransition(async () => {
      try {
        await action();
        if (toastMessage) showToast(toastMessage, "success");
      } catch (err) {
        showToast(err instanceof Error ? err.message : "Something went wrong. Try again.", "error");
      }
    });
  };

  return (
    <>
      <button
        type="button"
        onClick={() => (confirmTitle ? setConfirmOpen(true) : run())}
        disabled={isPending}
        className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap font-mono text-[11px] uppercase tracking-[0.12em] transition-all duration-150 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100 ${VARIANT_CLASS[variant]} ${className}`}
      >
        {icon}
        {isPending ? pendingLabel ?? label : label}
      </button>
      {confirmTitle && (
        <ConfirmDialog
          open={confirmOpen}
          title={confirmTitle}
          message={confirmMessage}
          confirmLabel={confirmLabel}
          tone={variant === "danger" ? "danger" : "default"}
          onConfirm={() => {
            setConfirmOpen(false);
            run();
          }}
          onCancel={() => setConfirmOpen(false)}
        />
      )}
    </>
  );
}
