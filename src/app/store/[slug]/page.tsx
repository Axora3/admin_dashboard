import Link from "next/link";
import { ArrowRight, PackageCheck, ShieldCheck, Sparkles, Truck } from "lucide-react";
import { notFound } from "next/navigation";
import { ProductCard } from "@/components/storefront/product-card";
import { ProductImage } from "@/components/storefront/product-image";
import { StoreClosed } from "@/components/storefront/store-closed";
import { formatNumber } from "@/lib/format";
import { isStoreOpen, loadStorefront } from "@/lib/storefront-data";
import { heroHeadline, themeClasses } from "@/lib/storefront-theme";
import { cn } from "@/lib/utils";

export default async function StoreHomePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const data = await loadStorefront(slug);
  if (!data) notFound();

  const { store, products, categories } = data;
  if (!isStoreOpen(store)) return <StoreClosed store={store} />;

  const classes = themeClasses(store.settings.theme.style);
  const bold = store.settings.theme.style === "bold";
  const editorial = store.settings.theme.style === "editorial";
  const featured = products.filter((product) => product.isFeatured).slice(0, 4);
  const heroProduct = featured[0] ?? products[0] ?? null;
  const showcase = (featured.length > 0 ? featured : products).slice(0, 4);
  const remaining = products
    .filter((product) => !showcase.some((item) => item.id === product.id))
    .slice(0, 8);
  const base = `/store/${slug}`;

  return (
    <div>
      <section className={cn("border-b border-ink-100", classes.hero)}>
        <div className="mx-auto grid max-w-7xl items-center gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[1.02fr_0.98fr] lg:gap-16 lg:px-8 lg:py-20">
          <div>
            <p className={cn("flex items-center gap-2", classes.eyebrow)}>
              <Sparkles className="h-3.5 w-3.5" /> {store.businessType || "Онлайн дэлгүүр"}
            </p>
            <h1
              className={cn(
                "mt-4 text-balance text-[38px] leading-[1.04] sm:text-[52px] lg:text-[60px]",
                classes.heading,
                bold ? classes.heroText : "text-ink-950",
              )}
            >
              {heroHeadline(store.settings.theme.style, store.name)}
            </h1>
            <p
              className={cn(
                "mt-5 max-w-xl text-[15px] leading-relaxed",
                bold ? "text-white/65" : "text-ink-600",
              )}
            >
              {store.description ||
                `${store.name} дэлгүүрийн шинэ бүтээгдэхүүн, онцгой саналуудыг тавтай морилно уу.`}
            </p>

            <div className="mt-7 flex flex-wrap items-center gap-3">
              <Link
                href={`${base}/products`}
                className={cn(
                  "inline-flex h-11 items-center gap-2 rounded-xl px-5 text-sm font-semibold transition",
                  bold
                    ? "bg-white text-ink-950 hover:bg-white/90"
                    : classes.button,
                )}
              >
                Бараа үзэх <ArrowRight className="h-4 w-4" />
              </Link>
              {featured.length > 0 ? (
                <Link
                  href={`${base}/products/${featured[0].slug}`}
                  className={cn(
                    "inline-flex h-11 items-center gap-2 rounded-xl px-5 text-sm font-semibold transition",
                    bold
                      ? "border border-white/25 text-white hover:bg-white/10"
                      : classes.buttonGhost,
                  )}
                >
                  Онцлох бараа
                </Link>
              ) : null}
            </div>

            <dl className="mt-9 flex flex-wrap gap-x-8 gap-y-4">
              <div>
                <dt
                  className={cn(
                    "text-[10px] font-semibold uppercase tracking-[0.18em]",
                    bold ? "text-white/40" : "text-ink-400",
                  )}
                >
                  Бараа
                </dt>
                <dd
                  className={cn(
                    "mt-1 text-lg font-semibold",
                    bold ? "text-white" : "text-ink-950",
                  )}
                >
                  {formatNumber(products.length)}
                </dd>
              </div>
              <div>
                <dt
                  className={cn(
                    "text-[10px] font-semibold uppercase tracking-[0.18em]",
                    bold ? "text-white/40" : "text-ink-400",
                  )}
                >
                  Ангилал
                </dt>
                <dd
                  className={cn(
                    "mt-1 text-lg font-semibold",
                    bold ? "text-white" : "text-ink-950",
                  )}
                >
                  {formatNumber(categories.length)}
                </dd>
              </div>
              <div>
                <dt
                  className={cn(
                    "text-[10px] font-semibold uppercase tracking-[0.18em]",
                    bold ? "text-white/40" : "text-ink-400",
                  )}
                >
                  Хүргэлт
                </dt>
                <dd
                  className={cn(
                    "mt-1 text-lg font-semibold",
                    bold ? "text-white" : "text-ink-950",
                  )}
                >
                  {store.settings.shipping.enabled ? "Хот дотор" : "Тохиролцоно"}
                </dd>
              </div>
            </dl>
          </div>

          <div className="relative">
            <div
              className={cn(
                "relative aspect-[4/5] overflow-hidden rounded-[28px] border shadow-raised sm:aspect-[5/5]",
                editorial ? "border-ink-900/10" : "border-white/40",
              )}
            >
              <ProductImage
                src={heroProduct?.images[0] ?? null}
                alt={heroProduct?.name ?? store.name}
                priority
              />
              {heroProduct ? (
                <div className="absolute inset-x-4 bottom-4 rounded-2xl border border-white/20 bg-black/45 p-4 text-white backdrop-blur-md">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/60">
                    Онцлох
                  </p>
                  <p className="mt-1 line-clamp-1 text-sm font-semibold">
                    {heroProduct.name}
                  </p>
                  <Link
                    href={`${base}/products/${heroProduct.slug}`}
                    className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-white/90 underline underline-offset-2"
                  >
                    Дэлгэрэнгүй <ArrowRight className="h-3 w-3" />
                  </Link>
                </div>
              ) : null}
            </div>
            <div className="pointer-events-none absolute -left-6 -top-6 hidden h-24 w-24 rounded-full border border-current opacity-10 sm:block" />
          </div>
        </div>
      </section>

      {categories.length > 0 ? (
        <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className={classes.eyebrow}>Ангилал</p>
              <h2 className={cn("mt-1.5 text-2xl", classes.heading)}>
                Юу хайж байна вэ?
              </h2>
            </div>
            <Link
              href={`${base}/products`}
              className="hidden items-center gap-1 text-xs font-semibold text-ink-500 hover:text-ink-900 sm:inline-flex"
            >
              Бүгдийг үзэх <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {categories.map((category) => (
              <Link
                key={category.id}
                href={`${base}/products?category=${encodeURIComponent(category.slug)}`}
                className="group flex items-center justify-between gap-3 rounded-2xl border border-ink-100 bg-white px-4 py-4 shadow-card transition hover:-translate-y-0.5 hover:border-ink-200"
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold text-ink-900">
                    {category.name}
                  </span>
                  <span className="mt-0.5 block text-[11px] text-ink-400">
                    {formatNumber(category.productCount)} бараа
                  </span>
                </span>
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ink-50 text-ink-400 transition group-hover:bg-[var(--store-primary)] group-hover:text-white">
                  <ArrowRight className="h-3.5 w-3.5" />
                </span>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {showcase.length > 0 ? (
        <section className="mx-auto max-w-7xl px-4 pb-12 sm:px-6 lg:px-8">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className={classes.eyebrow}>Онцлох</p>
              <h2 className={cn("mt-1.5 text-2xl", classes.heading)}>
                Сонгосон бүтээгдэхүүн
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
            {showcase.map((product, index) => (
              <ProductCard
                key={product.id}
                storeSlug={slug}
                product={product}
                currency={store.currency}
                priority={index === 0}
              />
            ))}
          </div>
        </section>
      ) : (
        <section className="mx-auto max-w-7xl px-4 py-16 text-center sm:px-6 lg:px-8">
          <PackageCheck className="mx-auto h-8 w-8 text-ink-300" />
          <h2 className={cn("mt-3 text-xl", classes.heading)}>
            Бараа удахгүй нэмэгдэнэ
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-ink-500">
            {store.name} дэлгүүр шинэ бүтээгдэхүүнээ бэлтгэж байна. Дараа дахин
            зочилно уу.
          </p>
        </section>
      )}

      {remaining.length > 0 ? (
        <section className="mx-auto max-w-7xl px-4 pb-12 sm:px-6 lg:px-8">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className={classes.eyebrow}>Бүх бараа</p>
              <h2 className={cn("mt-1.5 text-2xl", classes.heading)}>
                Танд таалагдаж магадгүй
              </h2>
            </div>
          </div>
          <div className="mt-5 grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4">
            {remaining.map((product) => (
              <ProductCard
                key={product.id}
                storeSlug={slug}
                product={product}
                currency={store.currency}
              />
            ))}
          </div>
          <div className="mt-8 text-center">
            <Link
              href={`${base}/products`}
              className={cn(
                "inline-flex h-11 items-center gap-2 rounded-xl px-5 text-sm font-semibold transition",
                classes.buttonGhost,
              )}
            >
              Бүх барааг үзэх <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </section>
      ) : null}

      <section className="mx-auto max-w-7xl px-4 pb-16 sm:px-6 lg:px-8">
        <div className="grid gap-3 rounded-3xl border border-ink-100 bg-white p-5 shadow-card sm:grid-cols-3 sm:p-6">
          <div className="flex items-start gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-ink-50 text-ink-500">
              <Truck className="h-4 w-4" />
            </span>
            <div>
              <p className="text-sm font-semibold text-ink-900">
                {store.settings.shipping.enabled ? "Хүргэлтийн үйлчилгээ" : "Хүргэлт"}
              </p>
              <p className="mt-1 text-xs leading-relaxed text-ink-500">
                {store.settings.shipping.note ||
                  (store.settings.shipping.enabled
                    ? "Захиалгыг баталгаажуулсны дараа хүргэнэ."
                    : "Хүргэлтийн нөхцөлийг дэлгүүрээс асууна уу.")}
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-ink-50 text-ink-500">
              <ShieldCheck className="h-4 w-4" />
            </span>
            <div>
              <p className="text-sm font-semibold text-ink-900">Найдвартай захиалга</p>
              <p className="mt-1 text-xs leading-relaxed text-ink-500">
                Захиалга бүр дэлгүүрийн админ системд шууд бүртгэгдэнэ.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-ink-50 text-ink-500">
              <PackageCheck className="h-4 w-4" />
            </span>
            <div>
              <p className="text-sm font-semibold text-ink-900">Төлбөрийн сонголт</p>
              <p className="mt-1 text-xs leading-relaxed text-ink-500">
                {[
                  store.settings.payment.codEnabled ? "Бэлэн мөнгө" : null,
                  store.settings.payment.bankTransferEnabled ? "Банкны шилжүүлэг" : null,
                ]
                  .filter(Boolean)
                  .join(" · ") || "Дэлгүүртэй тохирно"}
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
