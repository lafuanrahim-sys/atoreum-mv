/** Shared masthead for every admin list/detail page — the same editorial language as the dashboard home: a mono department label, a serif title, and a hairline rule instead of a boxed card header. */
export default function PageHeader({
  eyebrow,
  title,
  count,
  description,
  actions,
}: {
  eyebrow: string;
  title: string;
  count?: number;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-6 border-b-2 border-ivory pb-6">
      <div>
        <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-sand">{eyebrow}</p>
        <h1 className="mt-3 font-admin-heading text-3xl font-bold text-ivory md:text-4xl">
          {title}
          {count !== undefined && (
            <span className="ml-3 font-mono text-lg font-normal text-ivory-dim align-middle">— {count}</span>
          )}
        </h1>
        {description && <p className="mt-2 text-sm text-ivory-dim">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-3">{actions}</div>}
    </header>
  );
}
