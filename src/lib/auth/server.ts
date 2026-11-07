import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { DEMO_COOKIE, isDemoMode } from "@/lib/config";
import type { AdminUser } from "@/lib/types";
import { createSupabaseServerClient } from "@/lib/supabase/server";
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
    .select("id, email, full_name, role, is_super_admin, avatar_url, created_at")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile) return null;

  return {
    id: profile.id,
    email: profile.email ?? user.email ?? "",
    fullName: profile.full_name ?? user.email ?? "Admin",
    role: profile.role ?? "store_owner",
    isSuperAdmin: Boolean(profile.is_super_admin),
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
  if (!admin.isSuperAdmin) redirect("/admin/login?error=forbidden");
  return admin;
}
