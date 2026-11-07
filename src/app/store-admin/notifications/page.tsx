import { notFound } from "next/navigation";
import { withStoreAdmin } from "@/lib/auth/store-scope";
import { hasPermission } from "@/lib/platform/permissions";
import { NotificationCenter } from "@/components/admin/notification-center";

export default async function Page({ searchParams }: { searchParams: Promise<{ page?: string; category?: string; unread?: string }> }) {
  const query = await searchParams;
  return withStoreAdmin(admin => {
    if (!hasPermission(admin, "notifications.read", admin.storeId)) notFound();
    return NotificationCenter({ admin, page: Math.max(1, Number(query.page) || 1), category: query.category, unreadOnly: query.unread === "1", basePath: "/store-admin/notifications" });
  });
}
