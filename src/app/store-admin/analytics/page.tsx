import { withStoreAdmin } from "@/lib/auth/store-scope";
import { AnalyticsReport } from "@/components/admin/analytics-report";
export default async function Page({searchParams}:{searchParams:Promise<Record<string,string|undefined>>}) {const query=await searchParams;return withStoreAdmin(admin=>AnalyticsReport({storeId:admin.storeId,query,basePath:"/store-admin/analytics"}));}
