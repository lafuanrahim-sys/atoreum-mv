import Link from "next/link";
import { listAllReviews } from "@/lib/data/reviews.server";
import { getProductById } from "@/lib/data/products.server";
import { approveReviewAction, deleteReviewAction } from "@/app/actions/storeAdmin";
import AdminActionButton from "@/components/dashboard/AdminActionButton";
import StarRating from "@/components/ui/StarRating";
import PageHeader from "@/components/dashboard/PageHeader";

/**
 * Review moderation: customer reviews land here as "pending" and only show
 * on the storefront once approved.
 */
export default async function DashboardReviewsPage() {
  const reviews = await listAllReviews();
  const pending = reviews.filter((r) => r.status === "pending");
  const approved = reviews.filter((r) => r.status === "approved");

  const Row = async ({ review }: { review: (typeof reviews)[number] }) => {
    const product = await getProductById(review.productId);
    return (
      <li className="border-b border-line py-6 first:pt-0">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <StarRating rating={review.rating} />
            <span className="font-display italic text-ivory">{review.userName}</span>
            <span className="text-ivory-dim">
              on{" "}
              {product ? (
                <Link href={`/products/${product.id}`} className="text-gold-deep hover:underline">
                  {product.name}
                </Link>
              ) : (
                <span className="italic">deleted product</span>
              )}
            </span>
            <span className="font-mono text-xs text-ivory-dim">
              {new Date(review.createdAt).toLocaleDateString()}
            </span>
          </div>
          <div className="flex items-center gap-4">
            {review.status === "pending" && (
              <AdminActionButton
                action={async () => {
                  "use server";
                  await approveReviewAction(review.id);
                }}
                label="Approve"
                pendingLabel="Approving…"
                variant="primary"
                toastMessage={`Review by ${review.userName} approved and published.`}
              />
            )}
            <AdminActionButton
              action={async () => {
                "use server";
                await deleteReviewAction(review.id);
              }}
              label="Delete"
              pendingLabel="Deleting…"
              variant="danger"
              toastMessage="Review deleted."
              confirmTitle="Delete this review?"
              confirmMessage="This review will be permanently removed."
              confirmLabel="Delete"
            />
          </div>
        </div>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ivory-dim">{review.text}</p>
      </li>
    );
  };

  return (
    <div className="max-w-4xl">
      <PageHeader
        eyebrow="Moderation"
        title="Reviews"
        count={reviews.length}
        description="New reviews wait here for approval before appearing on the product page."
      />

      <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-mono text-[10px] uppercase tracking-[0.2em] text-ivory-dim">
          Pending Approval — {pending.length}
        </h2>
        {pending.length > 1 && (
          <AdminActionButton
            action={async () => {
              "use server";
              await Promise.all(pending.map((r) => approveReviewAction(r.id)));
            }}
            label={`Approve all (${pending.length})`}
            pendingLabel="Approving…"
            variant="primary"
            toastMessage={`${pending.length} reviews approved and published.`}
            confirmTitle="Approve all pending reviews?"
            confirmMessage={`All ${pending.length} pending reviews will be published to their product pages immediately.`}
            confirmLabel="Approve all"
          />
        )}
      </div>
      {pending.length === 0 ? (
        <p className="mt-3 text-sm text-ivory-dim">Nothing waiting — all caught up.</p>
      ) : (
        <ul className="mt-4 flex flex-col border-t border-line">
          {pending.map((r) => (
            <Row key={r.id} review={r} />
          ))}
        </ul>
      )}

      <h2 className="mt-12 font-mono text-[10px] uppercase tracking-[0.2em] text-ivory-dim">
        Published — {approved.length}
      </h2>
      {approved.length === 0 ? (
        <p className="mt-3 text-sm text-ivory-dim">No published reviews yet.</p>
      ) : (
        <ul className="mt-4 flex flex-col border-t border-line">
          {approved.map((r) => (
            <Row key={r.id} review={r} />
          ))}
        </ul>
      )}
    </div>
  );
}
