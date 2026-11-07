import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createStoreAction } from "@/app/admin/actions/stores";
import { PageHeader } from "@/components/admin/page-header";
import { StoreForm } from "@/components/admin/store-form";
import { buttonClasses } from "@/components/ui/button";
import { Alert } from "@/components/admin/alert";

export const metadata = { title: "Шинэ дэлгүүр" };

export default function NewStorePage() {
  return (
    <>
      <PageHeader
        title="Шинэ дэлгүүр нэмэх"
        description="AXORA платформд шинэ онлайн дэлгүүр бүртгэнэ. Дэлгүүр үүссэний дараа бараа, ангилал, домэйн тохируулж болно."
        actions={
          <Link href="/admin/stores" className={buttonClasses("secondary", "md")}>
            <ArrowLeft className="h-4 w-4" /> Жагсаалт руу
          </Link>
        }
      />
      <div className="mx-auto max-w-4xl">
        <Alert variant="info" className="mb-4">
          Нууц үгийг энд оруулахгүй. Эзэмшигч Supabase Auth урилгаар бүртгэлээ
          үүсгэж, store_members бүртгэлээр эрх авна.
        </Alert>
        <StoreForm action={createStoreAction} mode="create" />
      </div>
    </>
  );
}
