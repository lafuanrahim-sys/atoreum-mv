import Link from "next/link";
import { listAllReviews } from "@/lib/data/reviews.server";
import { getProductById } from "@/lib/data/products.server";
import { approveReviewAction, deleteReviewAction } from "@/app/actions/storeAdmin";

/**
 * Review moderation: customer reviews land here as "pending" and only show
 * on the storefront once approved.
 */
export default function DashboardReviewsPage() {
  const reviews = listAllReviews();
  const pending = reviews.filter((r) => r.status === "pending");
  const approved = reviews.filter((r) => r.status === "approved");

  const Row = ({ review }: { review: (typeof reviews)[number] }) => {
    const product = getProductById(review.productId);
    return (
      <li className="rounded-lg border border-line bg-ink p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span className="text-gold" aria-label={`${review.rating} out of 5 stars`}>
              {"★".repeat(review.rating)}
              <span className="text-ivory-dim/40">{"★".repeat(5 - review.rating)}</span>
            </span>
            <span className="text-ivory">{review.userName}</span>
            <span className="text-ivory-dim">
              on{" "}
              {product ? (
                <Link href={`/products/${product.id}`} className="text-gold hover:underline">
                  {product.name}
                </Link>
              ) : (
                <span className="italic">deleted product</span>
              )}
            </span>
            <span className="text-xs text-ivory-dim">
              {new Date(review.createdAt).toLocaleDateString()}
            </span>
          </div>
          <div className="flex items-center gap-4">
            {review.status === "pending" && (
              <form
                action={async () => {
                  "use server";
                  await approveReviewAction(review.id);
                }}
              >
                <button
                  type="submit"
                  className="bg-gold-deep px-4 py-1.5 text-[11px] uppercase tracking-[0.12em] text-ink transition-colors hover:bg-gold-deep/90"
                >
                  Approve
                </button>
              </form>
            )}
            <form
              action={async () => {
                "use server";
                await deleteReviewAction(review.id);
              }}
            >
              <button
                type="submit"
                className="text-[11px] uppercase tracking-[0.12em] text-ivory-dim transition-colors hover:text-red-400"
              >
                Delete
              </button>
            </form>
          </div>
        </div>
        <p className="mt-3 text-sm leading-relaxed text-ivory-dim">{review.text}</p>
      </li>
    );
  };

  return (
    <div className="max-w-4xl">
      <h1 className="font-display text-2xl text-ivory">Reviews ({reviews.length})</h1>
      <p className="mt-1 text-sm text-ivory-dim">
        New reviews wait here for approval before appearing on the product page.
      </p>

      <h2 className="mt-8 text-xs uppercase tracking-[0.2em] text-ivory">
        Pending Approval ({pending.length})
      </h2>
      {pending.length === 0 ? (
        <p className="mt-3 text-sm text-ivory-dim">Nothing waiting — all caught up.</p>
      ) : (
        <ul className="mt-4 flex flex-col gap-4">
          {pending.map((r) => (
            <Row key={r.id} review={r} />
          ))}
        </ul>
      )}

      <h2 className="mt-10 text-xs uppercase tracking-[0.2em] text-ivory">
        Published ({approved.length})
      </h2>
      {approved.length === 0 ? (
        <p className="mt-3 text-sm text-ivory-dim">No published reviews yet.</p>
      ) : (
        <ul className="mt-4 flex flex-col gap-4">
          {approved.map((r) => (
            <Row key={r.id} review={r} />
          ))}
        </ul>
      )}
    </div>
  );
}
