"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

export function ProductImage({
  src,
  alt,
  className,
  imageClassName,
  priority = false,
}: {
  src: string | null | undefined;
  alt: string;
  className?: string;
  imageClassName?: string;
  priority?: boolean;
}) {
  const [failed, setFailed] = useState(false);

  if (src && !failed) {
    return (
      <span className={cn("block h-full w-full overflow-hidden", className)}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={alt}
          onError={() => setFailed(true)}
          loading={priority ? "eager" : "lazy"}
          className={cn("h-full w-full object-cover", imageClassName)}
        />
      </span>
    );
  }

  return (
    <span
      className={cn(
        "flex h-full w-full items-center justify-center overflow-hidden",
        "bg-[radial-gradient(circle_at_25%_15%,var(--store-accent),transparent_55%),linear-gradient(140deg,var(--store-primary),#111827)]",
        className,
      )}
      aria-hidden
    >
      <span className="font-serif text-5xl font-semibold text-white/85">
        {alt.trim().slice(0, 1).toUpperCase() || "A"}
      </span>
    </span>
  );
}
