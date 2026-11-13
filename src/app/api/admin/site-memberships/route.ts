import { z } from "zod";
import { getCurrentAdmin } from "@/lib/auth/server";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { getStoreRegistry } from "@/lib/registry";
import { recordPlatformAudit } from "@/lib/registry/audit-store";
import { customerJson, customerFailure, CustomerError } from "@/lib/customer/access";
import { rateLimit } from "@/lib/rate-limit";
export async function POST(request: Request) {
  try {
    const actor = await getCurrentAdmin();
    if (!actor?.isSuperAdmin) throw new CustomerError("permission_denied",403);
    if (request.headers.get("origin") !== new URL(request.url).origin) throw new CustomerError("origin_forbidden",403);
    if (!rateLimit("membership:" + actor.id,30,60000).allowed) throw new CustomerError("rate_limited",429);
    const body = z.object({ siteId:z.string().min(1).max(128),userId:z.string().uuid(),role:z.enum(["owner","editor","viewer"]),status:z.enum(["active","disabled"]) }).strict().parse(await customerJson(request));
    if (!await getStoreRegistry().get(body.siteId)) throw new CustomerError("site_forbidden",403);
    const db = createSupabaseServiceClient();
    const profile = await db.from("profiles").select("id,role,is_active").eq("id",body.userId).maybeSingle();
    if (profile.error || !profile.data?.is_active || profile.data.role !== "store_admin") throw new CustomerError("invalid_input",422);
    const result = await db.from("site_memberships").upsert({ site_id:body.siteId,user_id:body.userId,role:body.role,status:body.status,updated_at:new Date().toISOString() },{onConflict:"site_id,user_id"});
    if(result.error) throw new CustomerError("integration_unavailable",503);
    await recordPlatformAudit({ actorUserId:actor.id,actorName:actor.fullName,storeId:body.siteId,action:"site_config.membership",resourceType:"site_integration",resourceId:body.userId,metadata:{role:body.role,status:body.status} });
    return Response.json({ok:true},{headers:{"Cache-Control":"no-store"}});
  } catch(error) { return customerFailure(error); }
}
