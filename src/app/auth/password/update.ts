"use server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentAdmin } from "@/lib/auth/server";
import { recordAudit } from "@/lib/audit";
export async function updatePassword(_: string, form: FormData): Promise<string> {
  const admin = await getCurrentAdmin();
  if (!admin) return "Сэргээх холбоосоор дахин орно уу.";
  const password = String(form.get("password") ?? "");
  if (password.length < 12 || password.length > 128) return "12–128 тэмдэгттэй нууц үг ашиглана уу.";
  const client = await createSupabaseServerClient();
  const { error } = await client.auth.updateUser({ password });
  if (error) return "Нууц үг шинэчилж чадсангүй. Сэргээх холбоос дахин авна уу.";
  await recordAudit(admin, { storeId: admin.storeId, action: "auth.password_changed", resourceType: "admin", resourceId: admin.id, metadata: { status: "success" } });
  await client.auth.signOut({ scope: "global" });
  return "Нууц үг шинэчлэгдлээ. Дахин нэвтэрнэ үү.";
}
