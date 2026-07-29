"use client";

import { useId, useState } from "react";

function EyeIcon({ off }: { off: boolean }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4">
      <path
        d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" strokeWidth="1.4" />
      {off && <path d="M4 4l16 16" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />}
    </svg>
  );
}

/**
 * Password input with a show/hide toggle -- without one, a mistyped
 * password is invisible until the whole form is submitted and rejected.
 * Same visual treatment as every other text input on this site
 * (border-line, focus:border-gold); the toggle sits inside the field via
 * negative margin rather than growing the input's own padding.
 */
export default function PasswordField({
  name,
  required,
  minLength,
  autoComplete,
  className,
}: {
  name: string;
  required?: boolean;
  minLength?: number;
  autoComplete?: string;
  className?: string;
}) {
  const [visible, setVisible] = useState(false);
  const id = useId();

  return (
    <div className={`flex items-center border border-line bg-transparent pr-2 focus-within:border-gold ${className ?? ""}`}>
      <input
        id={id}
        type={visible ? "text" : "password"}
        name={name}
        required={required}
        minLength={minLength}
        autoComplete={autoComplete}
        className="min-w-0 flex-1 bg-transparent px-4 py-3 text-sm text-ivory focus:outline-none"
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? "Hide password" : "Show password"}
        aria-pressed={visible}
        className="flex h-8 w-8 shrink-0 items-center justify-center text-ivory-dim transition-colors hover:text-gold"
      >
        <EyeIcon off={visible} />
      </button>
    </div>
  );
}
