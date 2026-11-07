import Link from "next/link";
import { ArrowLeft, Plus, Store as StoreIcon } from "lucide-react";
import { getRepository } from "@/lib/data";
import { getStoreContext } from "@/lib/store-context";
import { saveProductAction } from "@/app/admin/actions/products";
import { PageHeader } from "@/components/admin/page-header";
import { ProductForm } from "@/components/admin/product-form";
import { EmptyState } from "@/components/ui/empty-state";
import { buttonClasses } from "@/components/ui/button";

export const metadata = { title: "Шинэ бүтээгдэхүүн" };

function str(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function NewProductPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const repository = getRepository();
  const [stores, categories, context] = await Promise.all([
    repository.listStoreOptions(),
    repository.listCategories(),
    getStoreContext(),
  ]);
  const requestedStore = str(query.storeId);
  const defaultStoreId =
    (requestedStore && stores.some((store) => store.id === requestedStore)
      ? requestedStore
      : undefined) ?? context.storeId ?? undefined;

  if (stores.length === 0) {
    return (
      <>
        <PageHeader title="Шинэ бүтээгдэхүүн" />
        <div className="mx-auto max-w-2xl">
          <div className="axora-card">
            <EmptyState
              icon={StoreIcon}
              title="Эхлээд дэлгүүр үүсгэнэ үү"
              description="Бүтээгдэхүүн нэмэхийн тулд дор хаяж нэг идэвхтэй дэлгүүр байх шаардлагатай."
              action={
                <Link href="/admin/stores/new" className={buttonClasses("primary", "sm")}>
                  <Plus className="h-4 w-4" /> Дэлгүүр үүсгэх
                </Link>
              }
            />
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Шинэ бүтээгдэхүүн"
        description="Барааны мэдээлэл, үнэ, үлдэгдэл болон зургийг оруулна."
        actions={
          <Link href="/admin/products" className={buttonClasses("secondary", "md")}>
            <ArrowLeft className="h-4 w-4" /> Жагсаалт руу
          </Link>
        }
      />
      <div className="mx-auto max-w-4xl">
        <ProductForm
          action={saveProductAction}
          mode="create"
          stores={stores}
          categories={categories}
          defaultStoreId={defaultStoreId}
        />
      </div>
    </>
  );
}
