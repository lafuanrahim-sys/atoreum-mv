import Link from "next/link";

/** Clickable table-header cell that toggles asc/desc for one sort key via the URL, same param scheme across admin tables. */
export default function SortHeader({
  label,
  sortKey,
  activeSort,
  hrefFor,
  className = "",
}: {
  label: string;
  sortKey: string;
  /** Current `sort` search-param value, e.g. "spend-desc". */
  activeSort: string;
  hrefFor: (nextSort: string) => string;
  className?: string;
}) {
  const [activeKey, activeDir] = activeSort.split("-");
  const isActive = activeKey === sortKey;
  const nextDir = isActive && activeDir === "desc" ? "asc" : "desc";

  return (
    <th className={`py-3 pr-4 font-mono text-[10px] font-normal uppercase tracking-[0.2em] text-ivory-dim ${className}`}>
      <Link
        href={hrefFor(`${sortKey}-${nextDir}`)}
        className={`inline-flex items-center gap-1 transition-colors hover:text-gold-deep ${isActive ? "text-gold-deep" : ""}`}
      >
        {label}
        <svg
          viewBox="0 0 10 10"
          aria-hidden="true"
          className={`h-2.5 w-2.5 shrink-0 transition-opacity ${isActive ? "opacity-100" : "opacity-30"}`}
        >
          {isActive && activeDir === "asc" ? (
            <path d="M2 6l3-3 3 3" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
          ) : (
            <path d="M2 4l3 3 3-3" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
          )}
        </svg>
      </Link>
    </th>
  );
}
