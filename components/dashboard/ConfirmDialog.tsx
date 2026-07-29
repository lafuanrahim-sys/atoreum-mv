"use client";

import { useEffect } from "react";

export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  tone = "default",
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "default" | "danger";
  onConfirm: () => void;
  onCancel: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div
      className="modal-backdrop-in fixed inset-0 z-[200] flex items-center justify-center bg-ink/70 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
      onClick={onCancel}
    >
      <div
        className="modal-panel-in w-full max-w-sm border-t-2 border-ivory bg-ink p-7 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-sand">Confirm</p>
        <h2 id="confirm-dialog-title" className="mt-2 font-admin-heading text-xl font-semibold text-ivory">
          {title}
        </h2>
        {message && <p className="mt-3 text-sm leading-relaxed text-ivory-dim">{message}</p>}
        <div className="mt-7 flex justify-end gap-6">
          <button
            type="button"
            onClick={onCancel}
            className="font-mono text-xs uppercase tracking-[0.15em] text-ivory-dim transition-colors hover:text-ivory"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            autoFocus
            className={`px-5 py-2.5 font-mono text-xs uppercase tracking-[0.15em] transition-colors ${
              tone === "danger"
                ? "bg-red-600 text-white hover:bg-red-500"
                : "bg-gold-deep text-ink hover:bg-gold-deep/90"
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
