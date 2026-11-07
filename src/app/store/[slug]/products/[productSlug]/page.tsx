import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowRight,
  Check,
  PackageCheck,
  ShieldCheck,
  Truck,
} from "lucide-react";
import { AddToCart } from "@/components/storefront/add-to-cart";
import { ProductCard } from "@/components/storefront/product-card";
import { ProductGallery } from "@/components/storefront/product-gallery";
import { StoreClosed } from "@/components/storefront/store-closed";
import { formatCurrency } from "@/lib/format";
import {
  effectivePrice,
  isStoreOpen,
  loadStorefront,
} from "@/lib/storefront-data";
import { themeClasses } from "@/lib/storefront-theme";
import { cn, decodeParam } from "@/lib/utils";

export default async function StoreProductPage({
  params,
}: {
  params: Promise<{ slug: string; productSlug: string }>;
}) {
  const { slug: rawSlug, productSlug: rawProductSlug } = await params;
  const slug = decodeParam(rawSlug);
  const productSlug = decodeParam(rawProductSlug);
  const data = await loadStorefront(slug);
  if (!data) notFound();

  const { store, products } = data;
  if (!isStoreOpen(store)) return <StoreClosed store={store} />;

  const product = products.find((item) => item.slug === productSlug);
  if (!product) notFound();

  const classes = themeClasses(store.settings.theme.style);
  const price = effectivePrice(product);
  const hasSale = product.salePrice !== null && product.salePrice < product.price;
  const discount = hasSale
    ? Math.round(((product.price - (product.salePrice ?? 0)) / product.price) * 100)
    : 0;
  const related = products
    .filter(
      (item) =>
        item.id !== product.id &&
        (item.categoryId === product.categoryId || item.isFeatured),
    )
    .slice(0, 4);
  const base = `/store/${slug}`;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
      <nav className="flex flex-wrap items-center gap-1.5 text-[11px] text-ink-400">
        <Link href={base} className="hover:text-ink-700">
          Нүүр
        </Link>
        <span>/</span>
        <Link href={`${base}/products`} className="hover:text-ink-700">
          Бараа
        </Link>
        {product.categoryName ? (
          <>
            <span>/</span>
            <span className="text-ink-600">{product.categoryName}</span>
          </>
        ) : null}
        <span>/</span>
        <span className="line-clamp-1 text-ink-700">{product.name}</span>
      </nav>

      <div className="mt-6 grid gap-8 lg:grid-cols-[1.02fr_0.98fr] lg:gap-14">
        <ProductGallery images={product.images} name={product.name} />

        <div className="lg:pt-2">
          {product.categoryName ? (
            <p className={classes.eyebrow}>{product.categoryName}</p>
          ) : null}
          <h1
            className={cn(
              "mt-2 text-balance text-[30px] leading-tight sm:text-[40px]",
              classes.heading,
            )}
          >
            {product.name}
          </h1>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <span
              className={cn(
                "text-2xl font-bold tracking-tight",
                hasSale ? "text-[var(--store-accent)]" : "text-ink-950",
              )}
            >
              {formatCurrency(price, store.currency)}
            </span>
            {hasSale ? (
              <>
                <span className="text-base text-ink-400 line-through">
                  {formatCurrency(product.price, store.currency)}
                </span>
                <span className="rounded-full bg-[var(--store-accent)] px-2 py-0.5 text-[11px] font-bold text-white">
                  -{discount}%
                </span>
              </>
            ) : null}
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
            {product.stock > 0 ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-success-50 px-2.5 py-1 font-medium text-success-700">
                <Check className="h-3 w-3" /> Үлдэгдэлтэй
              </span>
            ) : (
              <span className="rounded-full bg-danger-50 px-2.5 py-1 font-medium text-danger-700">
                Үлдэгдэлгүй
              </span>
            )}
            {product.isNew ? (
              <span className="rounded-full bg-info-50 px-2.5 py-1 font-medium text-info-700">
                Шинэ
              </span>
            ) : null}
            {product.sku ? (
              <span className="rounded-full bg-ink-100 px-2.5 py-1 font-medium text-ink-600">
                SKU: {product.sku}
              </span>
            ) : null}
          </div>

          {product.description ? (
            <p className="mt-5 whitespace-pre-line text-sm leading-relaxed text-ink-600">
              {product.description}
            </p>
          ) : null}

          {product.variants.length > 0 ? (
            <div className="mt-5 space-y-3">
              {product.variants.map((variant) => (
                <div key={variant.name}>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-400">
                    {variant.name}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {variant.values.map((value) => (
                      <span
                        key={value}
                        className="rounded-lg border border-ink-200 bg-white px-2.5 py-1 text-xs font-medium text-ink-700"
                      >
                        {value}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
              <p className="text-[11px] leading-relaxed text-ink-400">
                Сонгосон өнгө, хэмжээгээ захиалгын тэмдэглэлд бичнэ үү.
              </p>
            </div>
          ) : null}

          <div className="mt-6 rounded-2xl border border-ink-100 bg-white p-4 shadow-card">
            <AddToCart
              storeSlug={slug}
              product={{
                id: product.id,
                name: product.name,
                slug: product.slug,
                stock: product.stock,
                images: product.images,
              }}
              unitPrice={price}
            />
          </div>

          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <div className="flex items-start gap-2.5 rounded-xl bg-ink-50 px-3 py-2.5">
              <Truck className="mt-0.5 h-4 w-4 shrink-0 text-ink-400" />
              <p className="text-[11px] leading-relaxed text-ink-600">
                {store.settings.shipping.enabled
                  ? store.settings.shipping.note ||
                    "Захиалгыг баталгаажуулсны дараа хүргэнэ."
                  : "Хүргэлтийн нөхцөлийг дэлгүүрээс асууна уу."}
              </p>
            </div>
            <div className="flex items-start gap-2.5 rounded-xl bg-ink-50 px-3 py-2.5">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-ink-400" />
              <p className="text-[11px] leading-relaxed text-ink-600">
                Захиалга шууд дэлгүүрийн админ системд бүртгэгдэнэ.
              </p>
            </div>
          </div>
        </div>
      </div>

      {related.length > 0 ? (
        <section className="mt-16 border-t border-ink-100 pt-10">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className={classes.eyebrow}>Мөн үзээрэй</p>
              <h2 className={cn("mt-1.5 text-2xl", classes.heading)}>
                Төстэй бүтээгдэхүүн
              </h2>
            </div>
            <Link
              href={`${base}/products`}
              className="inline-flex items-center gap-1 text-xs font-semibold text-ink-500 hover:text-ink-900"
            >
              Бүгдийг үзэх <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <div className="mt-5 grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4">
            {related.map((item) => (
              <ProductCard
                key={item.id}
                storeSlug={slug}
                product={item}
                currency={store.currency}
              />
            ))}
          </div>
        </section>
      ) : (
        <div className="mt-12 flex items-center justify-center gap-2 rounded-2xl border border-ink-100 bg-white px-4 py-5 text-xs text-ink-500">
          <PackageCheck className="h-4 w-4" /> Бүх барааг үзэхийг хүсвэл каталог руу
          орно уу.
        </div>
      )}
    </div>
  );
}
