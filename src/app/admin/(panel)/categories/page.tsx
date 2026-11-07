import { getRepository } from "@/lib/data";
import { getStoreContext } from "@/lib/store-context";
import { PageHeader } from "@/components/admin/page-header";
import { FilterBar } from "@/components/admin/filter-bar";
import { CategoryManager } from "@/components/admin/category-manager";
import { Badge } from "@/components/ui/badge";
import { buildQuery } from "@/lib/utils";

function str(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export const metadata = { title: "Ангилал" };

export default async function CategoriesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const repository = getRepository();
  const context = await getStoreContext();
  const requestedStore = str(params.storeId);
  const storeId = requestedStore ?? context.storeId ?? undefined;

  const [categories, stores] = await Promise.all([
    repository.listCategories(storeId),
    repository.listStoreOptions(),
  ]);

  const current = {
    storeId: requestedStore,
    search: str(params.search),
  };
  const activeStore = storeId ? stores.find((store) => store.id === storeId) : null;
  const back = `/admin/categories${buildQuery(current, {})}`;
  const filtered = current.search
    ? categories.filter((category) =>
        `${category.name} ${category.slug}`
          .toLowerCase()
          .includes(current.search!.toLowerCase()),
      )
    : categories;

  return (
    <>
      <PageHeader
        title="Ангилал"
        description={
          activeStore
            ? `${activeStore.name} дэлгүүрийн ангиллууд.`
            : "Бүх дэлгүүрийн барааны ангилал, эрэмбэ."
        }
        meta={
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge tone="neutral">Нийт {categories.length}</Badge>
            <Badge tone="brand" dot>
              {filtered.reduce((sum, category) => sum + category.productCount, 0)} бараа
            </Badge>
          </div>
        }
      />

      <FilterBar
        basePath="/admin/categories"
        searchPlaceholder="Ангиллын нэр…"
        current={current}
        filters={[
          {
            name: "storeId",
            label: "Бүх дэлгүүр",
            options: stores.map((store) => ({ value: store.id, label: store.name })),
          },
        ]}
      />

      <CategoryManager
        categories={filtered}
        stores={stores}
        storeId={storeId}
        back={back}
      />
    </>
  );
}
