import Link from "next/link";

/** Shared prev/next pager for admin tables — page numbers come from the URL, driven by the caller's own href builder. */
export default function Pagination({
  page,
  pageCount,
  hrefFor,
}: {
  page: number;
  pageCount: number;
  hrefFor: (page: number) => string;
}) {
  if (pageCount <= 1) return null;

  return (
    <div className="mt-10 flex items-center justify-center gap-8 border-t border-line pt-6">
      {page > 1 ? (
        <Link
          href={hrefFor(page - 1)}
          className="font-mono text-[10px] uppercase tracking-[0.2em] text-ivory-dim transition-colors hover:text-gold-deep"
        >
          ← Prev
        </Link>
      ) : (
        <span className="cursor-not-allowed font-mono text-[10px] uppercase tracking-[0.2em] text-ivory-dim opacity-30">
          ← Prev
        </span>
      )}
      <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-sand">
        {page} / {pageCount}
      </span>
      {page < pageCount ? (
        <Link
          href={hrefFor(page + 1)}
          className="font-mono text-[10px] uppercase tracking-[0.2em] text-ivory-dim transition-colors hover:text-gold-deep"
        >
          Next →
        </Link>
      ) : (
        <span className="cursor-not-allowed font-mono text-[10px] uppercase tracking-[0.2em] text-ivory-dim opacity-30">
          Next →
        </span>
      )}
    </div>
  );
}
