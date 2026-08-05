/**
 * Shared field primitives for admin forms — extracted from ProductForm.tsx
 * (still the first consumer, untouched) once a second and third form
 * needed the exact same look. Same markup/classes as there, byte for byte.
 */

export function FormSection({ eyebrow, title, children }: { eyebrow: string; title: string; children: React.ReactNode }) {
  return (
    <fieldset className="m-0 flex flex-col gap-5 border-0 border-t border-line p-0 pt-6">
      <legend className="flex items-baseline gap-3 pb-1">
        <span className="font-mono text-[10px] text-sand">{eyebrow}</span>
        <span className="font-admin-heading text-lg font-semibold text-ivory">{title}</span>
      </legend>
      {children}
    </fieldset>
  );
}

export function TextField({
  label,
  name,
  defaultValue,
  type = "text",
  step,
  required,
  hint,
}: {
  label: string;
  name: string;
  defaultValue?: string | number;
  type?: string;
  step?: string;
  required?: boolean;
  hint?: string;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-ivory-dim">{label}</span>
      <input
        type={type}
        name={name}
        step={step}
        defaultValue={defaultValue}
        required={required}
        className="border-b border-line bg-transparent px-1 py-2 font-mono text-sm text-ivory focus:border-gold-deep focus:outline-none"
      />
      {hint && <span className="text-[11px] text-ivory-dim/80">{hint}</span>}
    </label>
  );
}

export function SelectField({
  label,
  name,
  defaultValue,
  hint,
  children,
}: {
  label: string;
  name: string;
  defaultValue?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-ivory-dim">{label}</span>
      <select
        name={name}
        defaultValue={defaultValue}
        className="border-b border-line bg-transparent px-1 py-2 font-mono text-sm text-ivory focus:border-gold-deep focus:outline-none"
      >
        {children}
      </select>
      {hint && <span className="text-[11px] text-ivory-dim/80">{hint}</span>}
    </label>
  );
}

export function TextArea({
  label,
  name,
  defaultValue,
  rows,
}: {
  label: string;
  name: string;
  defaultValue?: string;
  rows: number;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-ivory-dim">{label}</span>
      <textarea
        name={name}
        rows={rows}
        defaultValue={defaultValue}
        className="border border-line bg-transparent px-3 py-2 text-sm text-ivory focus:border-gold-deep focus:outline-none"
      />
    </label>
  );
}

/** A derived figure, shown but never editable — the generated-column value came from the database, not this form. */
export function ComputedField({ label, value, tone = "default" }: { label: string; value: string; tone?: "default" | "gain" | "loss" }) {
  const toneClass = tone === "gain" ? "text-gold-deep" : tone === "loss" ? "text-red-400" : "text-ivory";
  return (
    <div className="flex flex-col gap-1.5">
      <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-ivory-dim">{label}</span>
      <span className={`border-b border-transparent px-1 py-2 font-mono text-sm tabular-nums ${toneClass}`}>{value}</span>
    </div>
  );
}
