import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { getRepository } from "@/lib/data";
import { PageHeader } from "@/components/admin/page-header";
import { Alert } from "@/components/admin/alert";
import { StoreSettingsForm } from "@/components/admin/store-settings-form";
import { StoreStatusBadge } from "@/components/admin/status-badges";
import { buttonClasses } from "@/components/ui/button";

export const metadata = { title: "Дэлгүүрийн тохиргоо" };

export default async function StoreSettingsPage({
  params,
  searchParams,
}: {
  params: Promise<{ storeId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { storeId } = await params;
  const query = await searchParams;
  const store = await getRepository().getStore(storeId);
  if (!store) notFound();

  return (
    <>
      <PageHeader
        title="Дэлгүүрийн тохиргоо"
        description="Public website, хүргэлт, төлбөр болон харагдах байдлын тохиргоо."
        meta={
          <div className="flex flex-wrap items-center gap-2">
            <StoreStatusBadge status={store.status} />
            <span className="text-2xs text-ink-400">{store.name}</span>
          </div>
        }
        actions={
          <>
            <Link
              href={`/store/${store.slug}`}
              target="_blank"
              className={buttonClasses("secondary", "md")}
            >
              <ExternalLink className="h-4 w-4" /> Public website
            </Link>
            <Link
              href={`/admin/stores/${store.id}`}
              className={buttonClasses("secondary", "md")}
            >
              <ArrowLeft className="h-4 w-4" /> Дэлгүүр рүү
            </Link>
          </>
        }
      />

      {String(query.saved) === "1" ? (
        <Alert variant="success" className="mb-4">
          Дэлгүүрийн тохиргоо амжилттай хадгалагдлаа.
        </Alert>
      ) : null}

      <div className="mx-auto max-w-4xl">
        <StoreSettingsForm store={store} />
      </div>
    </>
  );
}
