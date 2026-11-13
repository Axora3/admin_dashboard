import { getStoreRegistry } from "@/lib/registry";
import { canonicalBusinessType } from "@/lib/google/schema-registry";
import { notFound } from "next/navigation";
import { withStoreAdmin } from "@/lib/auth/store-scope";
import { hasPermission } from "@/lib/platform/permissions";
import { AnalyticsReport } from "@/components/admin/analytics-report";

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const query = await searchParams;
  return withStoreAdmin(async admin => {
    const site = await getStoreRegistry().get(admin.storeId);
    if (!site || canonicalBusinessType(site.businessType) !== "online_store") notFound();
    if (!hasPermission(admin, "analytics.read", admin.storeId)) notFound();
    // storeId is the server-side assignment; a storeId query parameter is never used.
    return AnalyticsReport({ storeId: admin.storeId, query: { from: query.from, to: query.to, group: query.group }, basePath: "/store-admin/analytics" });
  });
}
