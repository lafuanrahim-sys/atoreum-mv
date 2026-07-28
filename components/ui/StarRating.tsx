/** Shared star-rating display — reused by admin review moderation and storefront product cards. */
export default function StarRating({
  rating,
  size = 14,
  className = "",
}: {
  rating: number;
  size?: number;
  className?: string;
}) {
  const rounded = Math.round(rating);
  return (
    <span className={`inline-flex items-center gap-0.5 ${className}`} aria-label={`${rating} out of 5 stars`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <svg
          key={i}
          viewBox="0 0 20 20"
          width={size}
          height={size}
          aria-hidden="true"
          className={i < rounded ? "text-gold" : "text-ivory-dim/30"}
        >
          <path
            d="M10 1.5l2.6 5.4 5.9.8-4.3 4.2 1 5.9L10 15l-5.2 2.8 1-5.9L1.5 7.7l5.9-.8L10 1.5z"
            fill="currentColor"
          />
        </svg>
      ))}
    </span>
  );
}
