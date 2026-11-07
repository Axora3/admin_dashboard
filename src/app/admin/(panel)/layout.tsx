import { requireSuperAdmin } from "@/lib/auth/server";
import { getRepository } from "@/lib/data";
import { getStoreContext } from "@/lib/store-context";
import { AdminShell } from "@/components/admin/admin-shell";
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
    repository.listAuditLogs({ page: 1, pageSize: 6 }),
  ]);

  return (
    <AdminShell
      admin={admin}
      stores={stores}
      selectedStoreId={context.storeId}
      selectedStoreName={context.store?.name ?? null}
      notifications={activity.rows}
      banner={<DemoBanner />}
    >
      {children}
    </AdminShell>
  );
}
