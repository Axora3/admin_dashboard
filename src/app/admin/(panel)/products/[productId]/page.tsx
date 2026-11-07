import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Boxes,
  CalendarDays,
  ExternalLink,
  History,
  Package,
  Pencil,
  Power,
  Store as StoreIcon,
  Tag,
  Trash2,
  Wallet,
} from "lucide-react";
import { getRepository } from "@/lib/data";
import {
  deleteProductAction,
  toggleProductActiveAction,
} from "@/app/admin/actions/products";
import { PageHeader } from "@/components/admin/page-header";
import { StatCard } from "@/components/admin/stat-card";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Button, buttonClasses } from "@/components/ui/button";
import { ConfirmSubmit } from "@/components/ui/confirm-submit";
import { formatCurrency, formatDateTime, formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ productId: string }>;
}) {
  const { productId } = await params;
  const repository = getRepository();
  const product = await repository.getProduct(productId);
  if (!product) notFound();

  const [store, logs] = await Promise.all([
    repository.getStore(product.storeId),
    repository.listInventoryLogs(product.storeId, product.id, 1, 20),
  ]);

  const price = product.salePrice ?? product.price;
  const discount =
    product.salePrice !== null && product.price > 0
      ? Math.round(((product.price - product.salePrice) / product.price) * 100)
      : 0;

  return (
    <>
      <PageHeader
        title={product.name}
        description={store ? `${store.name} · ${product.categoryName ?? "Ангилалгүй"}` : undefined}
        meta={
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge tone={product.isActive ? "success" : "neutral"} dot>
              {product.isActive ? "Идэвхтэй" : "Идэвхгүй"}
            </Badge>
            {product.isFeatured ? <Badge tone="brand">Онцлох</Badge> : null}
            {product.isNew ? <Badge tone="info">Шинэ</Badge> : null}
            {product.stock <= 0 ? (
              <Badge tone="danger">Дууссан</Badge>
            ) : product.stock <= 5 ? (
              <Badge tone="warning">Бага үлдэгдэл</Badge>
            ) : null}
          </div>
        }
        actions={
          <>
            {store ? (
              <Link
                href={`/store/${store.slug}/product/${product.slug}`}
                target="_blank"
                className={buttonClasses("secondary", "md")}
              >
                <ExternalLink className="h-4 w-4" /> Public хуудас
              </Link>
            ) : null}
            <Link
              href={`/admin/products/${product.id}/edit`}
              className={buttonClasses("dark", "md")}
            >
              <Pencil className="h-4 w-4" /> Засах
            </Link>
          </>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Зарах үнэ"
          value={formatCurrency(price)}
          hint={
            product.salePrice !== null
              ? `${formatCurrency(product.price)}-с ${discount}% хямдарсан`
              : "Хямдралгүй"
          }
          icon={Wallet}
          accent="success"
        />
        <StatCard
          label="Үлдэгдэл"
          value={`${product.stock} ш`}
          hint={product.stock <= 5 ? "Анхаарал шаардлагатай" : "Хангалттай"}
          icon={Boxes}
          accent={product.stock <= 5 ? "warning" : "brand"}
        />
        <StatCard
          label="SKU"
          value={product.sku || "—"}
          hint="Дотоод код"
          icon={Tag}
          accent="neutral"
        />
        <StatCard
          label="Үүссэн"
          value={formatDate(product.createdAt)}
          hint={`Шинэчлэгдсэн: ${formatDate(product.updatedAt)}`}
          icon={CalendarDays}
          accent="info"
        />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <div className="space-y-4 xl:col-span-2">
          <Card>
            <CardHeader title="Зургууд" description="Public storefront дээр харагдана." />
            <CardContent>
              {product.images.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-ink-200 bg-surface-muted/50 py-14 text-center">
                  <Package className="h-7 w-7 text-ink-300" />
                  <p className="mt-2 text-xs text-ink-400">Зураг оруулаагүй байна.</p>
                  <Link
                    href={`/admin/products/${product.id}/edit`}
                    className={buttonClasses("secondary", "sm", "mt-3")}
                  >
                    Зураг нэмэх
                  </Link>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {product.images.map((url, index) => (
                    <div
                      key={`${url}-${index}`}
                      className="aspect-square overflow-hidden rounded-xl border border-ink-100 bg-surface-muted"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={url}
                        alt={`${product.name} ${index + 1}`}
                        className="h-full w-full object-cover"
                      />
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader title="Тайлбар" description="Бүтээгдэхүүний дэлгэрэнгүй мэдээлэл." />
            <CardContent>
              <p className="whitespace-pre-line text-[13px] leading-relaxed text-ink-600">
                {product.description || "Тайлбар оруулаагүй байна."}
              </p>
              {product.variants.length > 0 ? (
                <div className="mt-4 space-y-2.5 border-t border-ink-100 pt-4">
                  {product.variants.map((variant) => (
                    <div key={variant.name} className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-medium text-ink-500">{variant.name}:</span>
                      {variant.values.map((value) => (
                        <span
                          key={value}
                          className="rounded-lg border border-ink-200 bg-white px-2 py-0.5 text-2xs text-ink-700"
                        >
                          {value}
                        </span>
                      ))}
                    </div>
                  ))}
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader
              title="Үлдэгдлийн түүх"
              description="Энэ бүтээгдэхүүний сүүлийн 20 хөдөлгөөн."
              action={
                <Link
                  href={`/admin/inventory?storeId=${product.storeId}`}
                  className="text-2xs font-medium text-brand-600 hover:underline"
                >
                  Бүх үлдэгдэл
                </Link>
              }
            />
            {logs.rows.length === 0 ? (
              <EmptyState
                icon={History}
                title="Түүх байхгүй"
                description="Үлдэгдэл өөрчлөгдөхөд энд бүртгэгдэнэ."
              />
            ) : (
              <div className="axora-scroll">
                <table className="axora-table">
                  <thead>
                    <tr>
                      <th>Огноо</th>
                      <th>Шалтгаан</th>
                      <th className="text-right">Өөрчлөлт</th>
                      <th className="text-right">Үлдэгдэл</th>
                      <th>Хийсэн</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.rows.map((log) => (
                      <tr key={log.id}>
                        <td className="whitespace-nowrap text-2xs text-ink-400">
                          {formatDateTime(log.createdAt)}
                        </td>
                        <td>
                          <p className="text-[13px] text-ink-800">{log.reason}</p>
                          {log.note ? (
                            <p className="text-2xs text-ink-400">{log.note}</p>
                          ) : null}
                        </td>
                        <td
                          className={cn(
                            "text-right text-[13px] font-semibold tabular-nums",
                            log.changeAmount > 0 ? "text-success-700" : "text-danger-700",
                          )}
                        >
                          {log.changeAmount > 0 ? "+" : ""}
                          {log.changeAmount}
                        </td>
                        <td className="text-right text-[13px] tabular-nums text-ink-700">
                          {log.balanceAfter}
                        </td>
                        <td className="whitespace-nowrap text-2xs text-ink-400">
                          {log.actorName}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader title="Үйлдэл" description="Барааны төлөв удирдах." />
            <CardContent className="space-y-2">
              <Link
                href={`/admin/products/${product.id}/edit`}
                className={buttonClasses("primary", "md", "w-full")}
              >
                <Pencil className="h-4 w-4" /> Мэдээлэл засах
              </Link>
              <form action={toggleProductActiveAction}>
                <input type="hidden" name="productId" value={product.id} />
                <input type="hidden" name="back" value={`/admin/products/${product.id}`} />
                <Button type="submit" variant="secondary" size="md" className="w-full">
                  <Power className="h-4 w-4" />
                  {product.isActive ? "Идэвхгүй болгох" : "Идэвхжүүлэх"}
                </Button>
              </form>
              {store ? (
                <Link
                  href={`/store/${store.slug}/product/${product.slug}`}
                  target="_blank"
                  className={buttonClasses("secondary", "md", "w-full")}
                >
                  <ExternalLink className="h-4 w-4" /> Public хуудас нээх
                </Link>
              ) : null}
              <form action={deleteProductAction}>
                <input type="hidden" name="productId" value={product.id} />
                <input type="hidden" name="back" value="/admin/products" />
                <ConfirmSubmit
                  message={`"${product.name}" барааг бүр мөсөн устгах уу?`}
                  variant="danger"
                  size="md"
                  className="w-full"
                >
                  <Trash2 className="h-4 w-4" /> Бүр мөсөн устгах
                </ConfirmSubmit>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader title="Дэлгүүр" description="Бараа харьяалагдах дэлгүүр." />
            <CardContent className="space-y-2.5">
              {store ? (
                <>
                  <Link
                    href={`/admin/stores/${store.id}`}
                    className="flex items-center gap-2.5 rounded-xl p-1 transition hover:bg-ink-50"
                  >
                    <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-ink-50 text-ink-500">
                      <StoreIcon className="h-4 w-4" />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-[13px] font-medium text-ink-900">
                        {store.name}
                      </span>
                      <span className="block text-2xs text-ink-400">
                        /{store.slug} · {store.businessType}
                      </span>
                    </span>
                  </Link>
                  <div className="space-y-1.5 text-2xs text-ink-500">
                    <p>Үлдэгдэл: {product.stock} ш</p>
                    <p>Үнэ: {formatCurrency(price)}</p>
                    <p>Ангилал: {product.categoryName ?? "—"}</p>
                  </div>
                </>
              ) : (
                <p className="text-xs text-ink-400">Дэлгүүр олдсонгүй.</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader title="Төлөв" description="Public харагдах байдал." />
            <CardContent className="space-y-2 text-[13px] text-ink-600">
              <div className="flex items-center justify-between">
                <span>Идэвхтэй</span>
                <Badge tone={product.isActive ? "success" : "neutral"}>
                  {product.isActive ? "Тийм" : "Үгүй"}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span>Онцлох</span>
                <Badge tone={product.isFeatured ? "brand" : "neutral"}>
                  {product.isFeatured ? "Тийм" : "Үгүй"}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span>Шинэ</span>
                <Badge tone={product.isNew ? "info" : "neutral"}>
                  {product.isNew ? "Тийм" : "Үгүй"}
                </Badge>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <Link
        href="/admin/products"
        className="mt-4 inline-flex items-center gap-1.5 text-2xs font-medium text-ink-500 hover:text-brand-600"
      >
        <ArrowLeft className="h-3 w-3" /> Бүтээгдэхүүний жагсаалт руу
      </Link>
    </>
  );
}
