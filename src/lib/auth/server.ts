import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { DEMO_COOKIE, isDemoMode } from "@/lib/config";
import type { AdminUser } from "@/lib/types";
import { createSupabaseServerClient, createSupabaseServiceClient } from "@/lib/supabase/server";
import { verifySession } from "./session";

export async function getCurrentAdmin(): Promise<AdminUser | null> {
  if (isDemoMode()) {
    const token = (await cookies()).get(DEMO_COOKIE)?.value;
    const payload = await verifySession(token);
    if (!payload) return null;
    return {
      id: payload.sub,
      email: payload.email,
      fullName: payload.name,
      role: "super_admin",
      isSuperAdmin: true,
      avatarUrl: null,
      createdAt: new Date(0).toISOString(),
    };
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, email, full_name, role, is_super_admin, avatar_url, created_at, is_active")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.is_active) return null;
  const superAdmin = profile.role === "super_admin" && profile.is_super_admin === true;
  if (!superAdmin && profile.role !== "store_admin") return null;
  const { data: assignment } = superAdmin ? { data: null } : await createSupabaseServiceClient()
    .from("admin_assignments").select("store_id").eq("user_id", user.id).maybeSingle();
  if (!superAdmin && !assignment) return null;

  return {
    id: profile.id,
    email: profile.email ?? user.email ?? "",
    fullName: profile.full_name ?? user.email ?? "Admin",
    role: profile.role ?? "store_owner",
    isSuperAdmin: superAdmin,
    storeId: assignment?.store_id ?? null,
    avatarUrl: profile.avatar_url ?? null,
    createdAt: profile.created_at ?? new Date().toISOString(),
  };
}

/**
 * Server-side authorization gate. Every admin page and every mutating server
 * action calls this — client-supplied store IDs are never trusted on their own.
 */
export async function requireSuperAdmin(): Promise<AdminUser> {
  const admin = await getCurrentAdmin();
  if (!admin) redirect("/admin/login");
  if (!admin.isSuperAdmin) redirect("/store-admin");
  return admin;
}

export async function requireStoreAdmin(): Promise<AdminUser & { storeId: string }> {
  const admin = await getCurrentAdmin();
  if (!admin) redirect("/admin/login");
  if (admin.isSuperAdmin) redirect("/admin");
  if (admin.role !== "store_admin" || !admin.storeId) redirect("/admin/login?error=forbidden");
  const { getStoreRegistry } = await import("@/lib/registry");
  const store = await getStoreRegistry().get(admin.storeId);
  if (!store || store.status !== "active") redirect("/admin/login?error=inactive");
  return { ...admin, storeId: admin.storeId };
}
