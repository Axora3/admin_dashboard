import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CartProvider } from "@/components/storefront/cart-context";
import { DemoStoreBar } from "@/components/storefront/demo-store-bar";
import { StoreFooter } from "@/components/storefront/store-footer";
import { StoreHeader } from "@/components/storefront/store-header";
import { isDemoMode } from "@/lib/config";
import { loadStorefront } from "@/lib/storefront-data";
import { themeClasses, themeVars } from "@/lib/storefront-theme";

export const dynamic = "force-dynamic";

interface StoreLayoutProps {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const data = await loadStorefront(slug);
  if (!data) return { title: "Дэлгүүр олдсонгүй" };
  const { store } = data;
  const description =
    store.description ||
    `${store.name} — AXORA платформ дээр ажилладаг онлайн дэлгүүр.`;
  return {
    title: { default: store.name, template: `%s · ${store.name}` },
    description,
    robots: { index: true, follow: true },
    openGraph: {
      title: store.name,
      description,
      type: "website",
    },
  };
}

export default async function StoreLayout({ children, params }: StoreLayoutProps) {
  const { slug } = await params;
  const data = await loadStorefront(slug);
  if (!data) notFound();

  const { store, categories } = data;
  const classes = themeClasses(store.settings.theme.style);

  return (
    <CartProvider storeSlug={store.slug}>
      <div
        style={themeVars(store.settings.theme)}
        className={`flex min-h-screen flex-col ${classes.page}`}
      >
        {isDemoMode() ? <DemoStoreBar /> : null}
        <StoreHeader
          slug={store.slug}
          name={store.name}
          logoUrl={store.logoUrl}
          phone={store.phone}
          email={store.email}
          shippingNote={store.settings.shipping.note}
          categories={categories.map((category) => ({
            id: category.id,
            name: category.name,
            slug: category.slug,
          }))}
        />
        <main className="flex-1">{children}</main>
        <StoreFooter
          store={store}
          categories={categories.map((category) => ({
            id: category.id,
            name: category.name,
            slug: category.slug,
          }))}
        />
      </div>
    </CartProvider>
  );
}
