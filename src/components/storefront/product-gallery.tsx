"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { ProductImage } from "./product-image";

export function ProductGallery({
  images,
  name,
}: {
  images: string[];
  name: string;
}) {
  const [active, setActive] = useState(0);
  const list = images.length > 0 ? images : [null];
  const current = list[Math.min(active, list.length - 1)] ?? null;

  return (
    <div className="space-y-3">
      <div className="aspect-[4/5] overflow-hidden rounded-[24px] border border-ink-100 bg-ink-50">
        <ProductImage src={current} alt={name} priority />
      </div>
      {images.length > 1 ? (
        <div className="grid grid-cols-5 gap-2">
          {images.map((image, index) => (
            <button
              key={`${image}-${index}`}
              type="button"
              onClick={() => setActive(index)}
              aria-label={`${name} зураг ${index + 1}`}
              className={cn(
                "aspect-square overflow-hidden rounded-xl border bg-ink-50 transition",
                active === index
                  ? "border-[var(--store-primary)] ring-2 ring-[var(--store-primary)]/15"
                  : "border-ink-100 hover:border-ink-300",
              )}
            >
              <ProductImage src={image} alt={`${name} ${index + 1}`} />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
