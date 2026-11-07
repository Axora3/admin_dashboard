import { requireSuperAdmin } from "@/lib/auth/server";
import { getStoreContext } from "@/lib/store-context";
import { AnalyticsReport } from "@/components/admin/analytics-report";
export default async function Page({searchParams}:{searchParams:Promise<Record<string,string|undefined>>}) {await requireSuperAdmin();const query=await searchParams;const context=await getStoreContext();return <AnalyticsReport query={query} storeId={query.storeId??context.storeId??undefined} basePath="/admin/analytics"/>;}
