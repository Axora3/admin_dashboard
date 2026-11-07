import Link from "next/link";
import { ArrowRight, PackageSearch, Search } from "lucide-react";
import { notFound } from "next/navigation";
import { ProductCard } from "@/components/storefront/product-card";
import { StoreClosed } from "@/components/storefront/store-closed";
import { StorefrontPagination } from "@/components/storefront/pagination";
import { isStoreOpen, loadStorefront } from "@/lib/storefront-data";
import { themeClasses } from "@/lib/storefront-theme";
import { cn, paginate, safeInt } from "@/lib/utils";

const PAGE_SIZE = 12;

function str(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

const SORTS = [
  { value: "featured", label: "Онцлох" },
  { value: "newest", label: "Шинэ" },
  { value: "price_asc", label: "Үнэ ↑" },
  { value: "price_desc", label: "Үнэ ↓" },
  { value: "name", label: "Нэр" },
];

export default async function StoreProductsPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { slug } = await params;
  const query = await searchParams;
  const data = await loadStorefront(slug);
  if (!data) notFound();

  const { store, products, categories } = data;
  if (!isStoreOpen(store)) return <StoreClosed store={store} />;

  const classes = themeClasses(store.settings.theme.style);
  const base = `/store/${slug}/products`;
  const search = str(query.q).trim();
  const categorySlug = str(query.category);
  const sort = str(query.sort) || "featured";
  const page = Math.max(1, safeInt(str(query.page), 1));
  const activeCategory = categories.find((category) => category.slug === categorySlug);

  let rows = [...products];
  if (search) {
    const needle = search.toLowerCase();
    rows = rows.filter(
      (product) =>
        product.name.toLowerCase().includes(needle) ||
        product.description.toLowerCase().includes(needle) ||
        product.sku.toLowerCase().includes(needle) ||
        (product.categoryName ?? "").toLowerCase().includes(needle),
    );
  }
  if (activeCategory) {
    rows = rows.filter((product) => product.categoryId === activeCategory.id);
  }
  switch (sort) {
    case "newest":
      rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      break;
    case "price_asc":
      rows.sort(
        (a, b) => (a.salePrice ?? a.price) - (b.salePrice ?? b.price),
      );
      break;
    case "price_desc":
      rows.sort(
        (a, b) => (b.salePrice ?? b.price) - (a.salePrice ?? a.price),
      );
      break;
    case "name":
      rows.sort((a, b) => a.name.localeCompare(b.name));
      break;
    default:
      rows.sort(
        (a, b) =>
          Number(b.isFeatured) - Number(a.isFeatured) ||
          b.createdAt.localeCompare(a.createdAt),
      );
  }

  const result = paginate(rows, page, PAGE_SIZE);

  function hrefFor(nextPage: number) {
    const params = new URLSearchParams();
    if (search) params.set("q", search);
    if (categorySlug) params.set("category", categorySlug);
    if (sort !== "featured") params.set("sort", sort);
    if (nextPage > 1) params.set("page", String(nextPage));
    const qs = params.toString();
    return qs ? `${base}?${qs}` : base;
  }

  function filterHref(nextCategory: string | null) {
    const params = new URLSearchParams();
    if (search) params.set("q", search);
    if (nextCategory) params.set("category", nextCategory);
    if (sort !== "featured") params.set("sort", sort);
    const qs = params.toString();
    return qs ? `${base}?${qs}` : base;
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
      <nav className="flex items-center gap-1.5 text-[11px] text-ink-400">
        <Link href={`/store/${slug}`} className="hover:text-ink-700">
          Нүүр
        </Link>
        <span>/</span>
        <span className="text-ink-700">Бараа</span>
      </nav>

      <div className="mt-4 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className={classes.eyebrow}>Каталог</p>
          <h1 className={cn("mt-1.5 text-3xl", classes.heading)}>
            {activeCategory ? activeCategory.name : "Бүх бараа"}
          </h1>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-ink-500">
            {activeCategory?.description ||
              "Дэлгүүрийн бүх идэвхтэй бүтээгдэхүүн. Ангилал, үнэ болон нэрээр шүүж үзээрэй."}
          </p>
        </div>

        <form action={base} method="get" className="flex w-full gap-2 sm:w-auto">
          {categorySlug ? (
            <input type="hidden" name="category" value={categorySlug} />
          ) : null}
          {sort !== "featured" ? <input type="hidden" name="sort" value={sort} /> : null}
          <div className="relative min-w-0 flex-1 sm:w-64">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
            <input
              name="q"
              defaultValue={search}
              placeholder="Бараа хайх…"
              className="h-10 w-full rounded-xl border border-ink-200 bg-white pl-9 pr-3 text-sm text-ink-900 outline-none transition placeholder:text-ink-400 focus:border-[var(--store-primary)] focus:ring-4 focus:ring-[var(--store-primary)]/10"
            />
          </div>
          <button
            type="submit"
            className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-xl bg-[var(--store-primary)] px-4 text-sm font-semibold text-white transition hover:opacity-90"
          >
            Хайх
          </button>
        </form>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-2">
        <Link
          href={filterHref(null)}
          className={cn(
            "inline-flex h-8 items-center rounded-full border px-3 text-xs font-medium transition",
            !activeCategory
              ? "border-[var(--store-primary)] bg-[var(--store-primary)] text-white"
              : "border-ink-200 bg-white text-ink-600 hover:bg-ink-50",
          )}
        >
          Бүгд
        </Link>
        {categories.map((category) => (
          <Link
            key={category.id}
            href={filterHref(category.slug)}
            className={cn(
              "inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition",
              activeCategory?.id === category.id
                ? "border-[var(--store-primary)] bg-[var(--store-primary)] text-white"
                : "border-ink-200 bg-white text-ink-600 hover:bg-ink-50",
            )}
          >
            {category.name}
            <span
              className={cn(
                "text-[10px]",
                activeCategory?.id === category.id ? "text-white/70" : "text-ink-400",
              )}
            >
              {category.productCount}
            </span>
          </Link>
        ))}

        <div className="ml-auto flex flex-wrap items-center gap-1">
          {SORTS.map((option) => (
            <Link
              key={option.value}
              href={(() => {
                const params = new URLSearchParams();
                if (search) params.set("q", search);
                if (categorySlug) params.set("category", categorySlug);
                if (option.value !== "featured") params.set("sort", option.value);
                const qs = params.toString();
                return qs ? `${base}?${qs}` : base;
              })()}
              className={cn(
                "inline-flex h-8 items-center rounded-lg px-2.5 text-[11px] font-medium transition",
                sort === option.value
                  ? "bg-ink-900 text-white"
                  : "text-ink-500 hover:bg-ink-100",
              )}
            >
              {option.label}
            </Link>
          ))}
        </div>
      </div>

      <div className="mt-6 flex items-center justify-between gap-3 text-xs text-ink-500">
        <p>
          <span className="font-semibold text-ink-800">{result.total}</span> бараа олдлоо
        </p>
        {search ? (
          <Link
            href={filterHref(activeCategory?.slug ?? null)}
            className="inline-flex items-center gap-1 text-ink-500 hover:text-ink-900"
          >
            “{search}” хайлтыг цэвэрлэх
          </Link>
        ) : null}
      </div>

      {result.rows.length === 0 ? (
        <div className="mt-10 flex flex-col items-center justify-center rounded-3xl border border-dashed border-ink-200 bg-white px-6 py-20 text-center">
          <PackageSearch className="h-8 w-8 text-ink-300" />
          <h2 className="mt-3 text-lg font-semibold text-ink-950">
            Тохирох бараа олдсонгүй
          </h2>
          <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-ink-500">
            Хайлт эсвэл шүүлтүүрээ өөрчилж дахин оролдоно уу.
          </p>
          <Link
            href={base}
            className="mt-5 inline-flex h-10 items-center gap-2 rounded-xl bg-[var(--store-primary)] px-4 text-sm font-semibold text-white transition hover:opacity-90"
          >
            Бүх бараа <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4">
          {result.rows.map((product, index) => (
            <ProductCard
              key={product.id}
              storeSlug={slug}
              product={product}
              currency={store.currency}
              priority={index < 4}
            />
          ))}
        </div>
      )}

      <StorefrontPagination
        page={result.page}
        pageCount={result.pageCount}
        total={result.total}
        pageSize={result.pageSize}
        hrefFor={hrefFor}
      />
    </div>
  );
}
