"use client";

import { useState } from "react";
import Image from "next/image";

export default function ProductGallery({ images, name }: { images: string[]; name: string }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const active = images[activeIndex] ?? null;

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
      <div className="relative aspect-square w-[min(70vh,100%)] mx-auto overflow-hidden bg-photo-well rounded-sm">
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
              className="object-contain"
            />
          </div>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="font-display text-6xl text-ivory-dim/20">{name.charAt(0)}</span>
          </div>
        )}
      </div>

      {images.length > 1 && (
        <div className="flex gap-3">
          {images.map((img, index) => (
            <button
              key={img}
              type="button"
              onClick={() => setActiveIndex(index)}
              aria-label={`Show image ${index + 1}`}
              className={`relative h-20 w-20 shrink-0 overflow-hidden rounded-sm border bg-photo-well transition-colors ${
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
