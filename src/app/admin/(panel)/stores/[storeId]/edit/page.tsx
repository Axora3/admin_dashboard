import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { updateStoreAction } from "@/app/admin/actions/stores";
import { getRepository } from "@/lib/data";
import { PageHeader } from "@/components/admin/page-header";
import { StoreForm } from "@/components/admin/store-form";
import { buttonClasses } from "@/components/ui/button";

export const metadata = { title: "Дэлгүүр засах" };

export default async function EditStorePage({
  params,
}: {
  params: Promise<{ storeId: string }>;
}) {
  const { storeId } = await params;
  const store = await getRepository().getStore(storeId);
  if (!store) notFound();

  return (
    <>
      <PageHeader
        title={`${store.name} — мэдээлэл засах`}
        description="Дэлгүүрийн үндсэн мэдээлэл, эзэмшигч, домэйн болон theme-ийг шинэчилнэ."
        actions={
          <Link
            href={`/admin/stores/${store.id}`}
            className={buttonClasses("secondary", "md")}
          >
            <ArrowLeft className="h-4 w-4" /> Дэлгүүр рүү
          </Link>
        }
      />
      <div className="mx-auto max-w-4xl">
        <StoreForm action={updateStoreAction} mode="edit" store={store} />
      </div>
    </>
  );
}
