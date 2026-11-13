"use server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { requireStoreAdmin } from "@/lib/auth/server";
import { ACTIVE_SITE_COOKIE, membershipsFor } from "@/lib/auth/site-memberships";
import { getStoreRegistry } from "@/lib/registry";
import { rateLimit } from "@/lib/rate-limit";
export async function selectCustomerSite(form: FormData) {
  const actor = await requireStoreAdmin();
  const siteId = String(form.get("siteId") ?? "");
  if (!rateLimit("site-switch:" + actor.id, 30, 60000).allowed) throw new Error("Түр хүлээгээд дахин оролдоно уу.");
  const member = (await membershipsFor(actor.id)).find(m => m.siteId === siteId);
  const store = member ? await getStoreRegistry().get(siteId) : null;
  if (!member || !store || store.status !== "active") throw new Error("Энэ сайтад хандах эрхгүй.");
  (await cookies()).set(ACTIVE_SITE_COOKIE, siteId, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 30 });
  redirect("/store-admin");
}
