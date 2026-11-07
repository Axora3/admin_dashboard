import { getRepository } from "@/lib/data";
import type { AdminUser } from "@/lib/types";

export async function recordAudit(
  admin: Pick<AdminUser, "id" | "email" | "fullName"> & Partial<Pick<AdminUser, "role">>,
  entry: {
    storeId?: string | null;
    action: string;
    resourceType: string;
    resourceId?: string | null;
    metadata?: Record<string, unknown>;
  },
) {
  await getRepository().recordAudit({
    actorUserId: admin.id,
    actorName: admin.fullName || admin.email,
    storeId: entry.storeId ?? null,
    action: entry.action,
    resourceType: entry.resourceType,
    resourceId: entry.resourceId ?? null,
    metadata: { role: admin.role ?? "super_admin", status: "success", ...entry.metadata },
  });
}
