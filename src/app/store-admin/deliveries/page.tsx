import { notFound } from "next/navigation";
import { getStoreRegistry } from "@/lib/registry";
import { canonicalBusinessType } from "@/lib/google/schema-registry";
import { withStoreAdmin } from "@/lib/auth/store-scope";
import { assertPermission } from "@/lib/platform/permissions";
import { DeliveryWorkspace, type DeliveryQuery } from "@/components/delivery/delivery-workspace";

export const metadata = { title: "Миний дэлгүүрийн хүргэлт" };
export default async function StoreDeliveriesPage({ searchParams }: { searchParams: Promise<DeliveryQuery> }) {
  const query = await searchParams;
  return withStoreAdmin(async admin => {
    const site = await getStoreRegistry().get(admin.storeId);
    if (!site || canonicalBusinessType(site.businessType) !== "online_store") notFound();
    assertPermission(admin, "orders.read", admin.storeId);
    return DeliveryWorkspace({ storeId: admin.storeId, query });
  });
}
