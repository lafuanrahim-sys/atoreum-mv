"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Product, SortOption } from "@/lib/products";
import { CATEGORIES } from "@/lib/products";
import ProductCard from "./ProductCard";
import LuxSelect from "@/components/ui/LuxSelect";
import CategoryRail, { orderCategoriesByRoutine } from "@/components/products/CategoryRail";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { prefersReducedMotion, scrollToElement } from "@/lib/motion";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

gsap.registerPlugin(ScrollTrigger);

const PAGE_SIZE = 20;

const SORT_LABELS: Record<SortOption, string> = {
  featured: "Featured",
  newest: "Newest",
  "price-asc": "Price: Low to High",
  "price-desc": "Price: High to Low",
};

function sortProducts(products: Product[], sort: SortOption): Product[] {
  const copy = [...products];
  switch (sort) {
    case "price-asc":
      return copy.sort((a, b) => a.price - b.price);
    case "price-desc":
      return copy.sort((a, b) => b.price - a.price);
    case "newest":
      return copy.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    case "featured":
    default:
      return copy.sort((a, b) => Number(b.featured) - Number(a.featured));
  }
}

export default function ProductGrid({
  products,
  ratings,
}: {
  products: Product[];
  ratings?: Record<string, { average: number; count: number }>;
}) {
  const categories = ["All", ...orderCategoriesByRoutine(CATEGORIES)];
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [active, setActive] = useState(() => searchParams?.get("category") ?? "All");
  const [query, setQuery] = useState(() => searchParams?.get("q") ?? "");
  const [sort, setSort] = useState<SortOption>(() => (searchParams?.get("sort") as SortOption) || "featured");
  const [page, setPage] = useState(() => Number(searchParams?.get("page")) || 1);

  // `active` above only reads the URL once, at mount -- fine for a fresh
  // page load or a back/forward restore, but this component stays mounted
  // across a same-page client-side navigation (e.g. a "shop this category"
  // link elsewhere on /products, like the coverflow section), so a `?
  // category=` change from outside never reached `active` on its own, and
  // the write-back effect below would immediately overwrite the new URL
  // with the stale one anyway. Re-syncs whenever the URL's category
  // genuinely differs from current state; a no-op on the round-trip caused
  // by that same write-back effect, since by then `active` already matches.
  const scrollToGridOnNextChange = useRef(false);
  useEffect(() => {
    const urlCategory = searchParams?.get("category") ?? "All";
    if (urlCategory !== active) {
      // Flagged here, acted on below once the grid for the new category has
      // actually rendered (this effect fires before that -- setActive is
      // async) -- the coverflow section's category links land here with
      // Next's own scroll-to-top suppressed (scroll={false}) specifically so
      // this can carry the page to the results instead of the page's top.
      scrollToGridOnNextChange.current = true;
      setActive(urlCategory);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!scrollToGridOnNextChange.current) return;
    scrollToGridOnNextChange.current = false;
    if (ref.current) scrollToElement(ref.current, { offset: -96 });
  }, [active]);

  const filtered = useMemo(() => {
    const byCategory =
      active === "All" ? products : products.filter((p) => p.category === active);
    const bySearch = query.trim()
      ? byCategory.filter((p) => p.name.toLowerCase().includes(query.trim().toLowerCase()))
      : byCategory;
    return sortProducts(bySearch, sort);
  }, [products, active, query, sort]);

  // Any change to the result set invalidates the current page — but not on
  // the initial mount, where `page` was just read from the URL (e.g.
  // restored via back/forward) and shouldn't be clobbered back to 1. Compares
  // actual previous values (not a "have we mounted yet" boolean) since a
  // boolean flag flips permanently on React's dev-mode double-invoke of
  // effects, which made this fire a false reset on the very navigation it
  // was meant to preserve.
  const prevFilters = useRef({ active, query, sort });
  useEffect(() => {
    const prev = prevFilters.current;
    if (prev.active !== active || prev.query !== query || prev.sort !== sort) {
      setPage(1);
    }
    prevFilters.current = { active, query, sort };
  }, [active, query, sort]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const paged = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  // Mirror filter/sort/page state into the URL so back/forward navigation
  // restores the exact browsing state instead of resetting to page 1 with
  // no filters — App Router doesn't do this automatically for plain
  // component state, only for what's actually in the query string.
  useEffect(() => {
    const params = new URLSearchParams();
    if (active !== "All") params.set("category", active);
    if (query.trim()) params.set("q", query);
    if (sort !== "featured") params.set("sort", sort);
    if (currentPage !== 1) params.set("page", String(currentPage));
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [active, query, sort, currentPage, pathname, router]);

  const goToPage = (next: number) => {
    setPage(Math.min(pageCount, Math.max(1, next)));
    if (ref.current) scrollToElement(ref.current, { offset: -96 });
  };

  // "Surfacing" — waterline unveil: each photo is revealed by a rising
  // clip-path while the image inside settles from a deep zoom, then the
  // caption drifts up after it. (A per-column scroll-drift variant was
  // tried here and removed — it staggered row heights against each other,
  // which read as misaligned cards rather than depth.) Desktop only,
  // unchanged below — mobile gets its own entrance (see the md: split
  // via matchMedia just below).
  //
  // The grid keys by filter state, so this re-runs on filter changes and
  // doubles as the filter transition. Reduced motion: everything static.
  useEffect(() => {
    const container = ref.current;
    if (!container) return;
    const cards = Array.from(container.querySelectorAll<HTMLElement>("[data-reveal]"));
    if (cards.length === 0 || prefersReducedMotion()) return;

    const ctx = gsap.context(() => {
      const partsOf = (card: HTMLElement) => ({
        frame: card.querySelector("[data-card-frame]"),
        media: card.querySelector("[data-card-media]"),
        text: card.querySelector("[data-card-text]"),
      });

      const mm = gsap.matchMedia();

      mm.add("(min-width: 768px)", () => {
        cards.forEach((card) => {
          const { frame, media, text } = partsOf(card);
          if (frame) gsap.set(frame, { clipPath: "inset(100% 0% 0% 0%)" });
          if (media) gsap.set(media, { scale: 1.28, yPercent: 10 });
          if (text) gsap.set(text, { opacity: 0, y: 18 });
        });

        ScrollTrigger.batch(cards, {
          start: "top 88%",
          once: true,
          onEnter: (batch) => {
            batch.forEach((card, i) => {
              const { frame, media, text } = partsOf(card as HTMLElement);
              const tl = gsap.timeline({ delay: i * 0.09 });
              if (frame)
                tl.to(frame, { clipPath: "inset(0% 0% 0% 0%)", duration: 1, ease: "power4.out" }, 0);
              if (media)
                tl.to(media, { scale: 1, yPercent: 0, duration: 1.3, ease: "power3.out" }, 0);
              if (text)
                tl.to(text, { opacity: 1, y: 0, duration: 0.6, ease: "power2.out" }, 0.3);
            });
          },
        });
      });

      // Mobile: cards "deal" into place instead of just fading up — livelier
      // and more tactile than desktop's understated waterline, and reads as
      // an individual card arriving rather than a wide row settling (which
      // is what the desktop treatment is tuned for). Alternating left/right
      // rotation pivoted from the card's base + a back.out overshoot on
      // landing echoes a card being dropped onto a table, the same "dealt"
      // motif already carried by the coverflow section's sound design
      // (playCardFlick) elsewhere on this page.
      mm.add("(max-width: 767px)", () => {
        cards.forEach((card, i) => {
          const { frame, media, text } = partsOf(card);
          gsap.set(card, {
            rotate: i % 2 === 0 ? -5 : 5,
            y: 28,
            opacity: 0,
            transformOrigin: "50% 100%",
          });
          if (frame) gsap.set(frame, { clipPath: "inset(100% 0% 0% 0%)" });
          if (media) gsap.set(media, { scale: 1.2, yPercent: 6 });
          if (text) gsap.set(text, { opacity: 0, y: 12 });
        });

        ScrollTrigger.batch(cards, {
          start: "top 92%",
          once: true,
          onEnter: (batch) => {
            batch.forEach((card, i) => {
              const el = card as HTMLElement;
              const { frame, media, text } = partsOf(el);
              const tl = gsap.timeline({ delay: i * 0.07 });
              tl.to(el, { rotate: 0, y: 0, opacity: 1, duration: 0.65, ease: "back.out(1.6)" }, 0);
              if (frame)
                tl.to(frame, { clipPath: "inset(0% 0% 0% 0%)", duration: 0.7, ease: "power3.out" }, 0);
              if (media)
                tl.to(media, { scale: 1, yPercent: 0, duration: 0.8, ease: "power3.out" }, 0);
              if (text)
                tl.to(text, { opacity: 1, y: 0, duration: 0.45, ease: "power2.out" }, 0.2);
            });
          },
        });
      });
    }, container);
    return () => ctx.revert();
  }, [paged]);

  return (
    <div>
      <div className="flex flex-col gap-6 border-b border-line pb-8">
        <CategoryRail
          categories={categories}
          active={active}
          onChange={setActive}
          counts={Object.fromEntries(
            categories.map((category) => [
              category,
              category === "All"
                ? products.length
                : products.filter((p) => p.category === category).length,
            ])
          )}
        />

        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-end">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search products…"
            aria-label="Search products"
            className="min-h-11 border border-line bg-transparent px-4 py-2.5 text-sm text-ivory placeholder:text-ivory-dim focus:border-gold focus:outline-none"
          />
          <LuxSelect
            label="Sort by"
            value={sort}
            onChange={(v) => setSort(v as SortOption)}
            options={(Object.keys(SORT_LABELS) as SortOption[]).map((option) => ({
              value: option,
              label: SORT_LABELS[option],
            }))}
          />
        </div>
      </div>

      <div
        key={`${active}-${sort}-${query}-${currentPage}`}
        ref={ref}
        className="mt-12 grid grid-cols-2 gap-x-4 gap-y-10 sm:gap-x-8 sm:gap-y-16 lg:grid-cols-4"
      >
        {paged.map((product) => (
          <ProductCard key={product.id} product={product} rating={ratings?.[product.id]} />
        ))}
      </div>

      {filtered.length > 0 && pageCount > 1 && (
        <div className="mt-16 flex items-center justify-center gap-6">
          <button
            type="button"
            onClick={() => goToPage(currentPage - 1)}
            disabled={currentPage === 1}
            className="border border-line px-5 py-2.5 text-[10px] tracking-[0.2em] text-ivory-dim uppercase transition-colors hover:border-gold hover:text-gold disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:border-line disabled:hover:text-ivory-dim"
          >
            Prev
          </button>
          <span className="text-xs tracking-[0.15em] text-ivory-dim">
            Page {currentPage} of {pageCount}
          </span>
          <button
            type="button"
            onClick={() => goToPage(currentPage + 1)}
            disabled={currentPage === pageCount}
            className="border border-line px-5 py-2.5 text-[10px] tracking-[0.2em] text-ivory-dim uppercase transition-colors hover:border-gold hover:text-gold disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:border-line disabled:hover:text-ivory-dim"
          >
            Next
          </button>
        </div>
      )}

      {filtered.length === 0 && (
        <div className="mt-12 flex flex-col items-start gap-4">
          <p className="text-sm text-ivory-dim">
            No products match your search.
          </p>
          <button
            type="button"
            onClick={() => {
              setActive("All");
              setQuery("");
            }}
            className="border border-line px-5 py-2.5 text-[10px] tracking-[0.2em] text-ivory-dim uppercase transition-colors hover:border-gold hover:text-gold"
          >
            Clear filters
          </button>
        </div>
      )}
    </div>
  );
}
