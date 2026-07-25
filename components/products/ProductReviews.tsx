import type { Review } from "@/lib/data/reviews.server";
import { submitReviewAction } from "@/app/actions/storeAdmin";

function Stars({ rating, className }: { rating: number; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-0.5 ${className ?? ""}`} aria-label={`${rating} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <svg
          key={i}
          viewBox="0 0 24 24"
          fill={i <= rating ? "currentColor" : "none"}
          stroke="currentColor"
          strokeWidth={1.5}
          className="h-3.5 w-3.5"
          aria-hidden="true"
        >
          <path d="M12 3.5l2.47 5.3 5.8.7-4.28 3.98 1.13 5.72L12 16.35 6.88 19.2l1.13-5.72L3.73 9.5l5.8-.7L12 3.5Z" strokeLinejoin="round" />
        </svg>
      ))}
    </span>
  );
}

/**
 * Approved reviews + a submission form. Signed-out visitors get a sign-in
 * prompt; signed-in customers only get the form once they have a COMPLETED
 * order containing this product (verified purchase). New reviews are held
 * for admin approval (Dashboard → Reviews) before appearing here.
 */
export default function ProductReviews({
  productId,
  reviews,
  isLoggedIn,
  canReview,
  flag,
}: {
  productId: string;
  reviews: Review[];
  isLoggedIn: boolean;
  canReview: boolean;
  flag?: string;
}) {
  return (
    <div className="mt-28 border-t border-line pt-16">
      <div className="flex flex-wrap items-baseline justify-between gap-4">
        <h2 className="font-display text-2xl text-ivory">Reviews</h2>
        {reviews.length > 0 && (
          <p className="text-xs uppercase tracking-[0.15em] text-ivory-dim">
            {reviews.length} review{reviews.length === 1 ? "" : "s"}
          </p>
        )}
      </div>

      {reviews.length === 0 ? (
        <p className="mt-6 text-sm text-ivory-dim">
          No reviews yet — be the first to share your experience.
        </p>
      ) : (
        <ul className="mt-8 flex flex-col gap-8">
          {reviews.map((review) => (
            <li key={review.id} className="border-b border-line pb-8 last:border-b-0">
              <div className="flex flex-wrap items-center gap-3">
                <Stars rating={review.rating} className="text-gold" />
                <span className="text-sm text-ivory">{review.userName}</span>
                <span className="text-xs text-ivory-dim">
                  {new Date(review.createdAt).toLocaleDateString()}
                </span>
              </div>
              <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ivory-dim">
                {review.text}
              </p>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-12 max-w-xl">
        {flag === "submitted" && (
          <p className="mb-4 text-sm text-gold" role="status">
            Thank you — your review is awaiting approval.
          </p>
        )}
        {flag === "invalid" && (
          <p className="mb-4 text-sm text-red-400" role="alert">
            Please pick a rating and write a few words.
          </p>
        )}
        {flag === "not-purchased" && (
          <p className="mb-4 text-sm text-red-400" role="alert">
            Only customers with a completed order for this product can review it.
          </p>
        )}

        {isLoggedIn && canReview ? (
          <form action={submitReviewAction} className="flex flex-col gap-4">
            <h3 className="text-xs uppercase tracking-[0.2em] text-ivory">Write a review</h3>
            <input type="hidden" name="productId" value={productId} />

            <label className="flex flex-col gap-2">
              <span className="text-xs uppercase tracking-[0.15em] text-ivory-dim">Rating</span>
              <select
                name="rating"
                defaultValue="5"
                className="w-32 border border-line bg-transparent px-3 py-2 text-sm text-ivory focus:border-gold focus:outline-none"
              >
                {[5, 4, 3, 2, 1].map((n) => (
                  <option key={n} value={n} className="bg-ink-2">
                    {n} star{n === 1 ? "" : "s"}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-2">
              <span className="text-xs uppercase tracking-[0.15em] text-ivory-dim">Your review</span>
              <textarea
                name="text"
                rows={4}
                required
                maxLength={1000}
                className="border border-line bg-transparent px-4 py-3 text-sm text-ivory focus:border-gold focus:outline-none"
              />
            </label>

            <button
              type="submit"
              className="self-start bg-gold-deep px-6 py-3 text-xs uppercase tracking-[0.2em] text-ink transition-colors hover:bg-gold-deep/90"
            >
              Submit Review
            </button>
          </form>
        ) : isLoggedIn ? (
          <p className="text-sm text-ivory-dim">
            Reviews are open to verified buyers — you can write one once you&apos;ve purchased
            this product and your order is completed.
          </p>
        ) : (
          <p className="text-sm text-ivory-dim">
            <a
              href={`/login?from=${encodeURIComponent(`/products/${productId}`)}`}
              className="text-gold hover:underline"
            >
              Sign in
            </a>{" "}
            to write a review. Reviews are open to customers who have purchased this product.
          </p>
        )}
      </div>
    </div>
  );
}
