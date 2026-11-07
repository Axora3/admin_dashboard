import { requireSuperAdmin } from "@/lib/auth/server";
import { NotificationCenter } from "@/components/admin/notification-center";

export default async function Page({ searchParams }: { searchParams: Promise<{ page?: string; category?: string; unread?: string }> }) {
  const query = await searchParams;
  return <NotificationCenter admin={await requireSuperAdmin()} page={Math.max(1, Number(query.page) || 1)} category={query.category} unreadOnly={query.unread === "1"} basePath="/admin/notifications" />;
}
