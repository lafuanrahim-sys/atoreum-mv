"use client";

import { useRef, useState } from "react";
import Image from "next/image";

export default function ProductGallery({ images, name }: { images: string[]; name: string }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const active = images[activeIndex] ?? null;
  const hasMultiple = images.length > 1;
  const touchStartX = useRef<number | null>(null);

  const goTo = (index: number) => {
    setActiveIndex((index + images.length) % images.length);
  };
  const prev = () => goTo(activeIndex - 1);
  const next = () => goTo(activeIndex + 1);

  return (
    <div className="flex flex-col gap-4">
      {/* Width is explicitly min(70vh, 100%) rather than max-h + w-auto —
          the only children here are `fill` (position:absolute) images, which
          contribute no intrinsic size, so an "auto" dimension collapses to 0.
          Deriving width directly from the viewport keeps the box square and
          caps it so it can never grow taller than the screen on a wide
          desktop column (aspect-square alone sizes purely off column width,
          and a wide left column makes for a very tall square that runs below
          the fold). */}
      <div
        className="group relative aspect-square w-[min(70vh,100%)] mx-auto overflow-hidden rounded-2xl bg-photo-well outline-none"
        tabIndex={hasMultiple ? 0 : -1}
        role={hasMultiple ? "group" : undefined}
        aria-label={hasMultiple ? `${name} — image ${activeIndex + 1} of ${images.length}` : undefined}
        onKeyDown={(e) => {
          if (!hasMultiple) return;
          if (e.key === "ArrowLeft") {
            e.preventDefault();
            prev();
          } else if (e.key === "ArrowRight") {
            e.preventDefault();
            next();
          }
        }}
        onTouchStart={(e) => {
          touchStartX.current = e.touches[0].clientX;
        }}
        onTouchEnd={(e) => {
          if (touchStartX.current === null) return;
          const delta = e.changedTouches[0].clientX - touchStartX.current;
          touchStartX.current = null;
          if (Math.abs(delta) < 40) return;
          if (delta > 0) prev();
          else next();
        }}
      >
        {active ? (
          // `padding` on this element wouldn't constrain the `fill` image below —
          // the containing block for an absolutely positioned element is the
          // padding EDGE of its nearest positioned ancestor, so padding here
          // would be silently ignored and the image would paint edge-to-edge.
          // `inset-3` instead gives this wrapper an already-shrunk box for the
          // image to exactly fill — kept tight so the product reads large and
          // prominent, matching how Lebelage's own PDP displays it.
          <div className="absolute inset-3">
            <Image
              key={active}
              src={active}
              alt={name}
              fill
              priority
              sizes="(min-width: 1024px) 40vw, (min-width: 640px) 60vw, 90vw"
              className="object-contain"
            />
          </div>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="font-display text-6xl text-ivory-dim/20">{name.charAt(0)}</span>
          </div>
        )}

        {hasMultiple && (
          <>
            <button
              type="button"
              onClick={prev}
              aria-label="Previous image"
              className="absolute left-3 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-md border border-line bg-ink/70 text-ivory opacity-0 backdrop-blur-sm transition-opacity duration-200 hover:border-gold hover:text-gold focus-visible:opacity-100 motion-safe:group-hover:opacity-100"
            >
              <svg viewBox="0 0 16 16" aria-hidden="true" className="h-4 w-4">
                <path d="M10 3.5L5 8l5 4.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <button
              type="button"
              onClick={next}
              aria-label="Next image"
              className="absolute right-3 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-md border border-line bg-ink/70 text-ivory opacity-0 backdrop-blur-sm transition-opacity duration-200 hover:border-gold hover:text-gold focus-visible:opacity-100 motion-safe:group-hover:opacity-100"
            >
              <svg viewBox="0 0 16 16" aria-hidden="true" className="h-4 w-4">
                <path d="M6 3.5l5 4.5-5 4.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>

            <span className="absolute bottom-3 right-3 rounded-md border border-line bg-ink/70 px-2 py-1 text-[10px] tabular-nums tracking-[0.1em] text-ivory-dim backdrop-blur-sm">
              {activeIndex + 1} / {images.length}
            </span>
          </>
        )}
      </div>

      {hasMultiple && (
        <div className="flex gap-3 overflow-x-auto pb-1">
          {images.map((img, index) => (
            <button
              key={`${img}-${index}`}
              type="button"
              onClick={() => goTo(index)}
              aria-label={`Show image ${index + 1}`}
              aria-current={index === activeIndex}
              className={`relative h-20 w-20 shrink-0 overflow-hidden rounded-md border bg-photo-well transition-colors ${
                index === activeIndex ? "border-gold" : "border-line hover:border-ivory-dim"
              }`}
            >
              <div className="absolute inset-1.5">
                <Image src={img} alt="" fill className="object-contain" />
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
