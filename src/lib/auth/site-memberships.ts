import "server-only";
import { createSupabaseServiceClient } from "@/lib/supabase/server";

export const ACTIVE_SITE_COOKIE = "axora_active_site";
export type SiteRole = "owner" | "editor" | "viewer";
export interface SiteMembership { siteId: string; role: SiteRole; status: "active" | "disabled" }

/** Explicit disabled memberships override old assignments, including during migration. */
export function mergeMemberships(rows: Array<{ site_id: string; role: string; status: string }>, legacySite?: string | null): SiteMembership[] {
  const valid = rows.filter(row => ["owner", "editor", "viewer"].includes(row.role));
  const active: SiteMembership[] = valid.filter(row => row.status === "active").map(row => ({ siteId: row.site_id, role: row.role as SiteRole, status: "active" }));
  if (legacySite && !rows.some(row => row.site_id === legacySite)) active.push({ siteId: legacySite, role: "owner", status: "active" });
  return active.sort((a, b) => a.siteId.localeCompare(b.siteId));
}

export async function membershipsFor(userId: string): Promise<SiteMembership[]> {
  const db = createSupabaseServiceClient();
  const [members, legacy] = await Promise.all([
    db.from("site_memberships").select("site_id,role,status").eq("user_id", userId),
    db.from("admin_assignments").select("store_id").eq("user_id", userId).maybeSingle(),
  ]);
  // Before the additive migration only, preserve the existing one-site assignment.
  if (members.error && !["42P01", "PGRST205"].includes(members.error.code)) throw new Error("Membership verification unavailable");
  if (legacy.error) throw new Error("Membership verification unavailable");
  return mergeMemberships(members.data ?? [], legacy.data?.store_id);
}

export function selectedMembership(members: SiteMembership[], requested?: string | null): SiteMembership | null {
  return members.find(member => member.siteId === requested) ?? members[0] ?? null;
}
