import type { Product } from "@/lib/products";

function formatPrice(price: number, currency: Product["currency"]) {
  return `${currency} ${price.toLocaleString("en-US")}`;
}

export default function ProductCard({ product }: { product: Product }) {
  return (
    <article data-reveal className="group flex flex-col">
      <div className="relative aspect-[4/5] overflow-hidden bg-ink-2">
        {/*
          No product photography has been supplied yet, so this is a
          typographic placeholder rather than a broken <img>. Swap for
          next/image pointed at product.image once real photos land in
          /public/images/products/ — the aspect ratio and overlay are
          already sized for real product shots.
        */}
        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-moss/30 via-ink-2 to-ink">
          <span className="font-display text-6xl text-ivory-dim/20">
            {product.brand.charAt(0)}
          </span>
        </div>

        <div className="absolute top-4 left-4 text-[10px] tracking-[0.2em] text-ivory-dim uppercase">
          {product.category}
        </div>

        {!product.inStock && (
          <div className="absolute top-4 right-4 bg-ink/80 px-3 py-1 text-[10px] tracking-[0.2em] text-sand uppercase">
            Notify Me
          </div>
        )}

        <div className="absolute inset-0 bg-ink/0 transition-colors duration-500 group-hover:bg-ink/10" />
      </div>

      <div className="mt-5 flex flex-1 flex-col">
        <p className="text-[11px] tracking-[0.2em] text-sand uppercase">
          {product.brand}
        </p>
        <h3 className="mt-2 font-display text-lg text-ivory">
          {product.name}
        </h3>
        <p className="mt-2 text-sm leading-relaxed text-ivory-dim">
          {product.description}
        </p>

        <div className="mt-auto flex items-center justify-between pt-6">
          <span className="text-sm text-ivory">
            {formatPrice(product.price, product.currency)}
          </span>
          <button
            type="button"
            disabled
            title="Checkout is coming in the next build"
            className="border border-line px-4 py-2 text-[10px] tracking-[0.2em] text-ivory-dim uppercase transition-colors group-hover:border-gold group-hover:text-gold disabled:cursor-not-allowed"
          >
            View
          </button>
        </div>
      </div>
    </article>
  );
}
