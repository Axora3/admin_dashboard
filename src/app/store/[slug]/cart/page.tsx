import { notFound } from "next/navigation";
import { CartView } from "@/components/storefront/cart-view";
import { StoreClosed } from "@/components/storefront/store-closed";
import { isStoreOpen, loadStorefront } from "@/lib/storefront-data";
import { themeClasses } from "@/lib/storefront-theme";
import { cn } from "@/lib/utils";

export default async function StoreCartPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const data = await loadStorefront(slug);
  if (!data) notFound();

  const { store } = data;
  if (!isStoreOpen(store)) return <StoreClosed store={store} />;

  const classes = themeClasses(store.settings.theme.style);

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
      <div>
        <p className={classes.eyebrow}>Худалдан авалт</p>
        <h1 className={cn("mt-1.5 text-3xl", classes.heading)}>Миний сагс</h1>
        <p className="mt-2 text-sm leading-relaxed text-ink-500">
          Барааны тоо, хүргэлтийн дүнг шалгаад захиалгаа үргэлжлүүлээрэй.
        </p>
      </div>

      <div className="mt-8">
        <CartView
          storeSlug={store.slug}
          currency={store.currency}
          shipping={store.settings.shipping}
        />
      </div>
    </div>
  );
}
