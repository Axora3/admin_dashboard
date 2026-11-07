"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireSuperAdmin } from "@/lib/auth/server";
import { createSupabaseServiceClient, createSupabaseServerClient } from "@/lib/supabase/server";
import { getStoreRegistry } from "@/lib/registry";
import { recordAudit } from "@/lib/audit";
import type { ActionResult } from "@/lib/action-result";
import { enforceLimit } from "@/lib/platform/subscriptions";

export async function manageAdminAction(_: ActionResult | undefined, form: FormData): Promise<ActionResult> {
  const actor = await requireSuperAdmin();
  const operation = z.enum(["create", "update", "reset"]).parse(form.get("operation"));
  const client = createSupabaseServiceClient();
  let id = String(form.get("id") || "");
  let storeId: string | null = null;
  let before: unknown = null;
  try {
    if (operation === "create") {
      const email = z.string().email().parse(form.get("email"));
      const name = z.string().trim().min(2).max(100).parse(form.get("name"));
      storeId = z.string().min(1).parse(form.get("storeId"));
      if (!await getStoreRegistry().get(storeId)) throw new Error("Дэлгүүр олдсонгүй.");
      const assignedCount=await client.from("admin_assignments").select("user_id",{count:"exact",head:true}).eq("store_id",storeId);
      if(assignedCount.error)throw assignedCount.error;
      await enforceLimit(storeId,"admins",assignedCount.count??0,1);
      const { data: created, error } = await client.auth.admin.createUser({ email, email_confirm: true, user_metadata: { full_name: name } });
      if (error) throw error;
      id = created.user.id;
      const profile = await client.from("profiles").update({ role: "store_admin", is_super_admin: false, is_active: true, full_name: name }).eq("id", id);
      const assignment = profile.error ? profile : await client.from("admin_assignments").insert({ user_id: id, store_id: storeId });
      if (assignment.error) {
        await client.auth.admin.deleteUser(id);
        throw assignment.error;
      }
    } else {
      const { data: profile, error } = await client.from("profiles").select("id, full_name, email, role, is_active").eq("id", id).single();
      if (error || profile?.role !== "store_admin") throw new Error("Store Admin account олдсонгүй.");
      const assignment = await client.from("admin_assignments").select("store_id").eq("user_id", id).single();
      storeId = assignment.data?.store_id ?? null;
      before = { name: profile.full_name, active: profile.is_active, storeId };
      if (operation === "update") {
        const name = z.string().trim().min(2).max(100).parse(form.get("name"));
        const active = form.get("active") === "on";
        const assignedStore = z.string().min(1).parse(form.get("storeId"));
        if (!await getStoreRegistry().get(assignedStore)) throw new Error("Дэлгүүр олдсонгүй.");
        if(assignedStore!==storeId){const count=await client.from("admin_assignments").select("user_id",{count:"exact",head:true}).eq("store_id",assignedStore);if(count.error)throw count.error;await enforceLimit(assignedStore,"admins",count.count??0,1);}
        const assigned = await client.from("admin_assignments").update({ store_id: assignedStore }).eq("user_id", id);
        if (assigned.error) throw assigned.error;
        storeId = assignedStore;
        const updated = await client.from("profiles").update({ full_name: name, is_active: active }).eq("id", id);
        if (updated.error) throw updated.error;
        const banned = await client.auth.admin.updateUserById(id, { ban_duration: active ? "none" : "876000h" });
        if (banned.error) throw banned.error;
      }
    }
    await recordAudit(actor, { storeId, action: `admin.${operation}`, resourceType: "admin", resourceId: id,
      metadata: { before, after: { name: form.get("name"), active: form.get("active") === "on", storeId }, status: "success", role: actor.role } });
    if (operation === "create" || operation === "reset") {
      const user = await client.auth.admin.getUserById(id);
      if (!user.data.user?.email) throw new Error("Имэйл олдсонгүй.");
      const url = process.env.AXORA_APP_URL;
      if (!url) throw new Error("Account хадгалагдсан. AXORA_APP_URL тохируулж нууц үг сэргээх имэйл дахин илгээнэ үү.");
      const auth = await createSupabaseServerClient();
      const reset = await auth.auth.resetPasswordForEmail(user.data.user.email, { redirectTo: `${url}/auth/callback` });
      if (reset.error) throw reset.error;
    }
    revalidatePath("/admin/admins");
    return { ok: true, message: operation === "update" ? "Account шинэчлэгдлээ." : "Нууц үг тохируулах имэйл илгээлээ." };
  } catch (error) {
    await recordAudit(actor, { storeId, action: `admin.${operation}`, resourceType: "admin", resourceId: id || null, metadata: { status: "failed", role: actor.role } });
    revalidatePath("/admin/admins");
    return { ok: false, message: error instanceof Error ? error.message : "Үйлдэл амжилтгүй." };
  }
}
