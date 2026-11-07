import { requireSuperAdmin } from "@/lib/auth/server";
import { getRepository } from "@/lib/data";
import { getStoreContext } from "@/lib/store-context";
import { AdminShell } from "@/components/admin/admin-shell";
import { notificationPage } from "@/lib/platform/notifications";
import { DemoBanner } from "@/components/admin/demo-banner";

export const dynamic = "force-dynamic";

export default async function PanelLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const admin = await requireSuperAdmin();
  const repository = getRepository();
  const [stores, context, activity] = await Promise.all([
    repository.listStoreOptions(),
    getStoreContext(),
    // A notification outage must not take down every admin page.
    notificationPage(admin).catch(() => ({ rows: [], unread: 0 })),
  ]);

  return (
    <AdminShell
      admin={admin}
      stores={stores}
      selectedStoreId={context.storeId}
      selectedStoreName={context.store?.name ?? null}
      unreadCount={activity.unread}
      notifications={activity.rows.slice(0,6).map(n=>({id:n.id,actorUserId:null,actorName:"",storeId:n.store_id,storeName:null,action:n.title,resourceType:n.category,resourceId:null,metadata:{},createdAt:n.created_at}))}
      banner={<DemoBanner />}
    >
      {children}
    </AdminShell>
  );
}
