"use client";

import Link from "next/link";
import { Check, Minus, Plus, ShoppingBag } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { useCart } from "./cart-context";

export function AddToCart({
  storeSlug,
  product,
  unitPrice,
}: {
  storeSlug: string;
  product: {
    id: string;
    name: string;
    slug: string;
    stock: number;
    images: string[];
  };
  unitPrice: number;
}) {
  const { addItem } = useCart();
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);
  const max = Math.max(0, product.stock);
  const disabled = max <= 0;

  function add() {
    if (disabled) return;
    addItem(
      {
        id: product.id,
        name: product.name,
        slug: product.slug,
        unitPrice,
        image: product.images[0] ?? null,
        stock: max,
      },
      quantity,
    );
    setAdded(true);
    window.setTimeout(() => setAdded(false), 2200);
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex h-11 items-center rounded-xl border border-ink-200 bg-white">
          <button
            type="button"
            onClick={() => setQuantity((value) => Math.max(1, value - 1))}
            disabled={disabled || quantity <= 1}
            aria-label="Тоог багасгах"
            className="flex h-11 w-10 items-center justify-center text-ink-500 transition hover:text-ink-900 disabled:opacity-30"
          >
            <Minus className="h-4 w-4" />
          </button>
          <span className="w-10 text-center text-sm font-semibold text-ink-900">
            {quantity}
          </span>
          <button
            type="button"
            onClick={() => setQuantity((value) => Math.min(max, value + 1))}
            disabled={disabled || quantity >= max}
            aria-label="Тоог нэмэх"
            className="flex h-11 w-10 items-center justify-center text-ink-500 transition hover:text-ink-900 disabled:opacity-30"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>

        <button
          type="button"
          onClick={add}
          disabled={disabled}
          className={cn(
            "inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-xl px-5 text-sm font-semibold transition",
            "bg-[var(--store-primary)] text-white hover:opacity-90 active:opacity-95",
            "disabled:cursor-not-allowed disabled:opacity-40",
          )}
        >
          {added ? (
            <>
              <Check className="h-4 w-4" /> Сагсанд нэмэгдлээ
            </>
          ) : (
            <>
              <ShoppingBag className="h-4 w-4" />
              {disabled ? "Үлдэгдэлгүй" : "Сагсанд нэмэх"}
            </>
          )}
        </button>
      </div>

      {added ? (
        <Link
          href={`/store/${storeSlug}/cart`}
          className="inline-flex text-xs font-semibold text-[var(--store-accent)] underline underline-offset-2"
        >
          Сагс руу шилжих →
        </Link>
      ) : null}

      {!disabled && max <= 5 ? (
        <p className="text-xs font-medium text-warning-700">
          Зөвхөн {max} ширхэг үлдсэн — яараарай.
        </p>
      ) : null}
    </div>
  );
}
