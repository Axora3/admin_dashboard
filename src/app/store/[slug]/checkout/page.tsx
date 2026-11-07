import { notFound } from "next/navigation";
import { CheckoutForm } from "@/components/storefront/checkout-form";
import { StoreClosed } from "@/components/storefront/store-closed";
import { isStoreOpen, loadStorefront } from "@/lib/storefront-data";
import { themeClasses } from "@/lib/storefront-theme";
import { cn } from "@/lib/utils";

export default async function StoreCheckoutPage({
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
        <p className={classes.eyebrow}>Захиалга</p>
        <h1 className={cn("mt-1.5 text-3xl", classes.heading)}>
          Захиалга баталгаажуулах
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-ink-500">
          Хүргэлтийн мэдээллээ бөглөөд захиалгаа илгээнэ үү. Төлбөрийг
          хүргэлтийн үед эсвэл банкны шилжүүлгээр төлнө.
        </p>
      </div>

      <div className="mt-8">
        <CheckoutForm
          storeSlug={store.slug}
          currency={store.currency}
          shipping={store.settings.shipping}
          payment={store.settings.payment}
        />
      </div>
    </div>
  );
}
