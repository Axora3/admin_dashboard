import Link from "next/link";
import {
  CheckCircle2,
  ExternalLink,
  Package,
  Pencil,
  Plus,
  Power,
  Trash2,
} from "lucide-react";
import { getRepository } from "@/lib/data";
import { getStoreContext } from "@/lib/store-context";
import {
  bulkProductAction,
  deleteProductAction,
  toggleProductActiveAction,
} from "@/app/admin/actions/products";
import { PageHeader } from "@/components/admin/page-header";
import { FilterBar } from "@/components/admin/filter-bar";
import { SelectAllCheckbox } from "@/components/admin/select-all-checkbox";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Pagination } from "@/components/ui/pagination";
import { Button, buttonClasses } from "@/components/ui/button";
import { ConfirmSubmit } from "@/components/ui/confirm-submit";
import { formatCurrency, formatDate } from "@/lib/format";
import { buildQuery, cn, safeInt } from "@/lib/utils";

function str(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const repository = getRepository();
  const context = await getStoreContext();
  const requestedStore = str(params.storeId);
  const storeId = requestedStore ?? context.storeId ?? undefined;

  const current = {
    search: str(params.search),
    storeId: requestedStore,
    categoryId: str(params.categoryId),
    stock: str(params.stock) ?? "all",
    status: str(params.status) ?? "all",
    sort: str(params.sort) ?? "newest",
    page: str(params.page),
  };

  const [result, stores, categories] = await Promise.all([
    repository.listProducts({
      storeId,
      search: current.search,
      categoryId: current.categoryId,
      stock: current.stock as "all" | "in" | "low" | "out",
      status: current.status as "all" | "active" | "inactive",
      sort: current.sort as
        | "newest"
        | "name"
        | "price_asc"
        | "price_desc"
        | "stock_asc"
        | "stock_desc",
      page: safeInt(current.page, 1),
      pageSize: 20,
    }),
    repository.listStoreOptions(),
    repository.listCategories(storeId),
  ]);

  const storeNames = new Map(stores.map((store) => [store.id, store.name]));
  const nextPath = `/admin/products${buildQuery(current, { page: current.page })}`;
  const activeStore = storeId ? stores.find((store) => store.id === storeId) : null;

  return (
    <>
      <PageHeader
        title="Бараа бүтээгдэхүүн"
        description={
          activeStore
            ? `${activeStore.name} дэлгүүрийн бараа.`
            : "Бүх дэлгүүрийн бараа бүтээгдэхүүн, үнэ болон үлдэгдэл."
        }
        meta={
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge tone="neutral">Нийт {result.total}</Badge>
            <Badge tone="success" dot>
              {result.rows.filter((product) => product.isActive).length} идэвхтэй
            </Badge>
            <Badge tone="warning" dot>
              {result.rows.filter((product) => product.stock > 0 && product.stock <= 5).length}{" "}
              бага үлдэгдэл
            </Badge>
            <Badge tone="danger" dot>
              {result.rows.filter((product) => product.stock <= 0).length} дууссан
            </Badge>
          </div>
        }
        actions={
          <Link
            href={`/admin/products/new${storeId ? `?storeId=${storeId}` : ""}`}
            className={buttonClasses("primary", "md")}
          >
            <Plus className="h-4 w-4" /> Шинэ бүтээгдэхүүн
          </Link>
        }
      />

      <FilterBar
        basePath="/admin/products"
        searchPlaceholder="Барааны нэр эсвэл SKU…"
        current={current}
        filters={[
          {
            name: "storeId",
            label: "Бүх дэлгүүр",
            options: stores.map((store) => ({ value: store.id, label: store.name })),
          },
          {
            name: "categoryId",
            label: "Бүх ангилал",
            options: categories.map((category) => ({
              value: category.id,
              label: category.name,
            })),
          },
          {
            name: "status",
            label: "Бүх төлөв",
            options: [
              { value: "active", label: "Идэвхтэй" },
              { value: "inactive", label: "Идэвхгүй" },
            ],
          },
          {
            name: "stock",
            label: "Бүх үлдэгдэл",
            options: [
              { value: "in", label: "Байгаа" },
              { value: "low", label: "Бага (≤5)" },
              { value: "out", label: "Дууссан" },
            ],
          },
          {
            name: "sort",
            label: "Эрэмбэлэх",
            options: [
              { value: "newest", label: "Шинэ нь эхэндээ" },
              { value: "name", label: "Нэрээр" },
              { value: "price_asc", label: "Үнэ өсөхөөр" },
              { value: "price_desc", label: "Үнэ буурахаар" },
              { value: "stock_asc", label: "Үлдэгдэл өсөхөөр" },
              { value: "stock_desc", label: "Үлдэгдэл буурахаар" },
            ],
          },
        ]}
      />

      <form id="product-bulk-form" action={bulkProductAction}>
        <input type="hidden" name="back" value={nextPath} />
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-ink-100 bg-white px-3 py-2 shadow-card">
          <span className="text-xs font-medium text-ink-500">Бөөн үйлдэл:</span>
          <Button type="submit" name="operation" value="activate" variant="secondary" size="sm">
            <CheckCircle2 className="h-3.5 w-3.5" /> Идэвхжүүлэх
          </Button>
          <Button type="submit" name="operation" value="deactivate" variant="secondary" size="sm">
            <Power className="h-3.5 w-3.5" /> Идэвхгүй болгох
          </Button>
          <ConfirmSubmit
            name="operation"
            value="delete"
            message="Сонгосон бараануудыг бүр мөсөн устгах уу?"
            variant="danger"
            size="sm"
          >
            <Trash2 className="h-3.5 w-3.5" /> Устгах
          </ConfirmSubmit>
          <span className="ml-auto text-2xs text-ink-400">
            Хүснэгтийн зүүн талын checkbox-оор сонгоно уу.
          </span>
        </div>
      </form>

      {result.rows.length === 0 ? (
        <Card>
          <EmptyState
            icon={Package}
            title="Бүтээгдэхүүн олдсонгүй"
            description={
              current.search || current.status !== "all" || current.stock !== "all"
                ? "Хайлт болон шүүлтүүрт тохирох бараа байхгүй."
                : "Эхний бүтээгдэхүүнээ нэмж эхэлнэ үү."
            }
            action={
              <Link
                href={`/admin/products/new${storeId ? `?storeId=${storeId}` : ""}`}
                className={buttonClasses("primary", "sm")}
              >
                <Plus className="h-4 w-4" /> Бараа нэмэх
              </Link>
            }
          />
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="axora-scroll">
            <table className="axora-table min-w-[980px]">
              <thead>
                <tr>
                  <th className="w-8">
                    <SelectAllCheckbox formId="product-bulk-form" />
                  </th>
                  <th>Бүтээгдэхүүн</th>
                  <th>Дэлгүүр</th>
                  <th>Ангилал</th>
                  <th className="text-right">Үнэ</th>
                  <th className="text-right">Үлдэгдэл</th>
                  <th>Төлөв</th>
                  <th>Шинэчлэгдсэн</th>
                  <th className="w-24" />
                </tr>
              </thead>
              <tbody>
                {result.rows.map((product) => (
                  <tr key={product.id}>
                    <td>
                      <input
                        type="checkbox"
                        name="ids"
                        value={product.id}
                        form="product-bulk-form"
                        aria-label={`${product.name} сонгох`}
                        className="h-3.5 w-3.5 rounded border-ink-300 text-brand-600 focus:ring-brand-500"
                      />
                    </td>
                    <td>
                      <div className="flex items-center gap-2.5">
                        <Avatar
                          name={product.name}
                          src={product.images[0] ?? null}
                          size="sm"
                        />
                        <div className="min-w-0">
                          <Link
                            href={`/admin/products/${product.id}`}
                            className="block max-w-[220px] truncate text-[13px] font-medium text-ink-900 hover:text-brand-600"
                          >
                            {product.name}
                          </Link>
                          <p className="max-w-[220px] truncate text-2xs text-ink-400">
                            {product.sku || "SKU байхгүй"}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="whitespace-nowrap text-[13px] text-ink-600">
                      {storeNames.get(product.storeId) ?? "—"}
                    </td>
                    <td className="whitespace-nowrap text-[13px] text-ink-600">
                      {product.categoryName ?? "—"}
                    </td>
                    <td className="whitespace-nowrap text-right text-[13px]">
                      {product.salePrice !== null ? (
                        <div>
                          <span className="font-medium text-ink-900">
                            {formatCurrency(product.salePrice)}
                          </span>
                          <span className="ml-1 text-2xs text-ink-400 line-through">
                            {formatCurrency(product.price)}
                          </span>
                        </div>
                      ) : (
                        <span className="font-medium text-ink-900">
                          {formatCurrency(product.price)}
                        </span>
                      )}
                    </td>
                    <td className="text-right">
                      <span
                        className={cn(
                          "inline-flex rounded-md px-1.5 py-0.5 text-2xs font-semibold",
                          product.stock <= 0
                            ? "bg-danger-50 text-danger-700"
                            : product.stock <= 5
                              ? "bg-warning-50 text-warning-700"
                              : "bg-success-50 text-success-700",
                        )}
                      >
                        {product.stock} ш
                      </span>
                    </td>
                    <td>
                      <div className="flex flex-wrap gap-1">
                        <Badge tone={product.isActive ? "success" : "neutral"} dot>
                          {product.isActive ? "Идэвхтэй" : "Идэвхгүй"}
                        </Badge>
                        {product.isFeatured ? <Badge tone="brand">Онцлох</Badge> : null}
                        {product.isNew ? <Badge tone="info">Шинэ</Badge> : null}
                      </div>
                    </td>
                    <td className="whitespace-nowrap text-2xs text-ink-400">
                      {formatDate(product.updatedAt)}
                    </td>
                    <td>
                      <div className="flex items-center justify-end gap-1">
                        <Link
                          href={`/admin/products/${product.id}/edit`}
                          className={buttonClasses("ghost", "icon", "h-8 w-8")}
                          title="Засах"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Link>
                        <form action={toggleProductActiveAction}>
                          <input type="hidden" name="productId" value={product.id} />
                          <input type="hidden" name="back" value={nextPath} />
                          <button
                            type="submit"
                            title={product.isActive ? "Идэвхгүй болгох" : "Идэвхжүүлэх"}
                            className={buttonClasses("ghost", "icon", "h-8 w-8")}
                          >
                            <Power className="h-3.5 w-3.5" />
                          </button>
                        </form>
                        <form action={deleteProductAction}>
                          <input type="hidden" name="productId" value={product.id} />
                          <input type="hidden" name="back" value={nextPath} />
                          <ConfirmSubmit
                            message={`"${product.name}" барааг бүр мөсөн устгах уу?`}
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-danger-500 hover:bg-danger-50 hover:text-danger-600"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </ConfirmSubmit>
                        </form>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination
            page={result.page}
            pageCount={result.pageCount}
            total={result.total}
            pageSize={result.pageSize}
            basePath="/admin/products"
            query={current}
          />
        </Card>
      )}

      <p className="mt-4 flex items-center gap-1.5 text-2xs text-ink-400">
        <ExternalLink className="h-3 w-3" />
        Бараа public storefront дээр автоматаар харагдана.
      </p>
    </>
  );
}
