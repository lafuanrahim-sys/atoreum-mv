import type { StockStatus } from "@/lib/types";

const LABELS: Record<StockStatus, string> = {
  "in-stock": "In Stock",
  "low-stock": "Low Stock",
  "out-of-stock": "Out of Stock",
};

// One theme-flipping combo for every status: ink-2/ivory stay readable in
// both light and dark themes (the old bg-ink/80 + light text turned
// light-on-light in light mode, and vanished against the bg-ink page on the
// product detail view). Status is carried by the label text, not color
// alone; the hairline border keeps the badge defined on same-color grounds.
const STYLES: Record<StockStatus, string> = {
  "in-stock": "text-ivory",
  "low-stock": "text-ivory",
  "out-of-stock": "text-ivory-dim",
};

export default function StockBadge({ status }: { status: StockStatus }) {
  return (
    <span
      className={`inline-block border border-line bg-ink-2/85 px-3 py-1 text-[10px] tracking-[0.2em] uppercase ${STYLES[status]}`}
    >
      {LABELS[status]}
    </span>
  );
}
