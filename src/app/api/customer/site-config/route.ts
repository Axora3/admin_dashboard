import { z } from "zod";
import { authorizeCustomer, customerFailure, customerJson, CustomerError } from "@/lib/customer/access";
import { prepareCustomerSchema, refreshCustomerSite } from "@/lib/customer/data";
import { getStoreRegistry } from "@/lib/registry";
import { canonicalBusinessType, modulesForBusiness } from "@/lib/google/schema-registry";
import { publicSiteIntegrationConfig } from "@/lib/google/site-config";
import { recordPlatformAudit } from "@/lib/registry/audit-store";
import { withPlatformLock } from "@/lib/platform/locks";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    const { actor, store } = await authorizeCustomer(request, null, true);
    const body = z.object({ operation: z.enum(["prepare","modules"]), enabledModules: z.array(z.string()).optional() }).strict().parse(await customerJson(request));
    if (body.operation === "prepare") return Response.json({ ok: true, ...await prepareCustomerSchema(actor, store) }, { headers: { "Cache-Control": "no-store" } });
    const allowed = modulesForBusiness(canonicalBusinessType(store.businessType));
    const modules = [...new Set(body.enabledModules ?? [])];
    if (modules.includes("inventory") && !modules.includes("products")) throw new CustomerError("invalid_input", 422);
    if (modules.some(module => !allowed.includes(module as never))) throw new CustomerError("invalid_input", 422);
    await withPlatformLock("customer-site:" + store.id, async () => {
      const current = await getStoreRegistry().get(store.id);
      if (!current) throw new Error("site_missing");
      await getStoreRegistry().updateSheets(store.id, { ...current.sheets, enabledModules: modules, configurationVersion: (current.sheets.configurationVersion ?? 1) + 1 });
      await recordPlatformAudit({ actorUserId: actor.id, actorName: actor.fullName, storeId: store.id, action: "site_config.modules", resourceType: "site_integration", resourceId: store.id, metadata: { enabledModules: modules } });
    });
    refreshCustomerSite(store);
    const updated = await getStoreRegistry().get(store.id);
    return Response.json({ ok: true, config: updated ? publicSiteIntegrationConfig(updated) : null }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return customerFailure(error); }
}
