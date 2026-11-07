import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getRepository } from "@/lib/data";
import { saveProductAction } from "@/app/admin/actions/products";
import { PageHeader } from "@/components/admin/page-header";
import { ProductForm } from "@/components/admin/product-form";
import { buttonClasses } from "@/components/ui/button";

export const metadata = { title: "Бүтээгдэхүүн засах" };

export default async function EditProductPage({
  params,
}: {
  params: Promise<{ productId: string }>;
}) {
  const { productId } = await params;
  const repository = getRepository();
  const product = await repository.getProduct(productId);
  if (!product) notFound();

  const [stores, categories] = await Promise.all([
    repository.listStoreOptions(),
    repository.listCategories(product.storeId),
  ]);

  return (
    <>
      <PageHeader
        title={`${product.name} — засах`}
        description="Барааны үнэ, үлдэгдэл, зураг болон харагдах байдлыг шинэчилнэ."
        actions={
          <Link
            href={`/admin/products/${product.id}`}
            className={buttonClasses("secondary", "md")}
          >
            <ArrowLeft className="h-4 w-4" /> Бараа руу
          </Link>
        }
      />
      <div className="mx-auto max-w-4xl">
        <ProductForm
          action={saveProductAction}
          mode="edit"
          product={product}
          stores={stores}
          categories={categories}
        />
      </div>
    </>
  );
}
