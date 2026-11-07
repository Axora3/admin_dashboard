import Link from "next/link";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Product } from "@/lib/types";
import { effectivePrice } from "@/lib/storefront-data";
import { ProductImage } from "./product-image";

export function ProductCard({
  storeSlug,
  product,
  currency,
  priority = false,
}: {
  storeSlug: string;
  product: Product;
  currency: string;
  priority?: boolean;
}) {
  const price = effectivePrice(product);
  const hasSale = product.salePrice !== null && product.salePrice < product.price;
  const discount = hasSale
    ? Math.round(((product.price - (product.salePrice ?? 0)) / product.price) * 100)
    : 0;
  const outOfStock = product.stock <= 0;

  return (
    <Link
      href={`/store/${storeSlug}/products/${product.slug}`}
      className="group block"
    >
      <div className="relative aspect-[4/5] overflow-hidden rounded-2xl border border-ink-100 bg-ink-50">
        <ProductImage
          src={product.images[0] ?? null}
          alt={product.name}
          priority={priority}
          imageClassName="transition duration-500 group-hover:scale-[1.04]"
        />
        <div className="absolute left-3 top-3 flex flex-col gap-1.5">
          {hasSale ? (
            <span className="rounded-full bg-[var(--store-accent)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
              -{discount}%
            </span>
          ) : null}
          {product.isNew ? (
            <span className="rounded-full bg-white/95 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-ink-800 shadow-sm">
              Шинэ
            </span>
          ) : null}
        </div>
        {outOfStock ? (
          <div className="absolute inset-0 flex items-center justify-center bg-white/70 backdrop-blur-[1px]">
            <span className="rounded-full bg-ink-950 px-3 py-1 text-[11px] font-semibold text-white">
              Дууссан
            </span>
          </div>
        ) : null}
      </div>

      <div className="mt-3">
        {product.categoryName ? (
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-400">
            {product.categoryName}
          </p>
        ) : null}
        <h3 className="mt-1 line-clamp-2 text-sm font-medium leading-snug text-ink-900 transition group-hover:text-[var(--store-primary)]">
          {product.name}
        </h3>
        <div className="mt-1.5 flex items-baseline gap-2">
          <span
            className={cn(
              "text-sm font-semibold",
              hasSale ? "text-[var(--store-accent)]" : "text-ink-900",
            )}
          >
            {formatCurrency(price, currency)}
          </span>
          {hasSale ? (
            <span className="text-xs text-ink-400 line-through">
              {formatCurrency(product.price, currency)}
            </span>
          ) : null}
        </div>
      </div>
    </Link>
  );
}
