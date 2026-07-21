"use client";

import { useState } from "react";
import Image from "next/image";

export default function ProductGallery({ images, name }: { images: string[]; name: string }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const active = images[activeIndex] ?? null;

  return (
    <div className="flex flex-col gap-4">
      <div className="relative aspect-square overflow-hidden bg-ink-2 rounded-sm">
        {active ? (
          <Image
            key={active}
            src={active}
            alt={name}
            fill
            priority
            className="object-cover"
          />
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
              className={`relative h-20 w-20 shrink-0 overflow-hidden rounded-sm border transition-colors ${
                index === activeIndex ? "border-gold" : "border-line hover:border-ivory-dim"
              }`}
            >
              <Image src={img} alt="" fill className="object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
