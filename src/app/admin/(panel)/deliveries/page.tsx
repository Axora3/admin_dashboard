import { requireSuperAdmin } from "@/lib/auth/server";
import { getStoreContext } from "@/lib/store-context";
import { DeliveryWorkspace, queryText, type DeliveryQuery } from "@/components/delivery/delivery-workspace";

export const metadata = { title: "Хүргэлт" };
export default async function DeliveriesPage({ searchParams }: { searchParams: Promise<DeliveryQuery> }) {
  await requireSuperAdmin();
  const query = await searchParams;
  const context = await getStoreContext();
  return <DeliveryWorkspace superAdmin storeId={queryText(query.storeId) ?? context.storeId ?? undefined} query={query} />;
}
