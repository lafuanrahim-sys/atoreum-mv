import type { StockStatus } from "@/lib/types";

const LABELS: Record<StockStatus, string> = {
  "in-stock": "In Stock",
  "low-stock": "Low Stock",
  "out-of-stock": "Out of Stock",
};

const STYLES: Record<StockStatus, string> = {
  "in-stock": "bg-ink/80 text-sand",
  "low-stock": "bg-ink/80 text-gold",
  "out-of-stock": "bg-ink/80 text-ivory-dim",
};

export default function StockBadge({ status }: { status: StockStatus }) {
  return (
    <span
      className={`inline-block px-3 py-1 text-[10px] tracking-[0.2em] uppercase ${STYLES[status]}`}
    >
      {LABELS[status]}
    </span>
  );
}
