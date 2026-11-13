import "server-only";
import { z } from "zod";

export const CUSTOMER_PRICING = { monthly: 20000, annual: 228000, annualDiscount: 5, currency: "MNT", trialDays: 30 } as const;
const timestamp = z.string().datetime();
const billingSchema = z.object({
  site_id: z.string(), as_of: timestamp,
  confirmed_delivery_at: timestamp.nullable(),
  subscription: z.object({ status: z.enum(["awaiting_delivery", "trial", "active", "past_due", "suspended", "cancelled", "expired"]), plan: z.enum(["monthly", "annual"]).nullable(), next_billing_at: timestamp.nullable() }),
  payments: z.array(z.object({ id: z.string().max(128), status: z.enum(["pending", "paid", "failed", "refunded", "cancelled"]), amount: z.number().finite().nonnegative(), currency: z.literal("MNT"), created_at: timestamp, paid_at: timestamp.nullable() })).max(200),
});
export type AxoraBilling = z.infer<typeof billingSchema>;
export async function customerBilling(siteId: string): Promise<{ available: true; data: AxoraBilling; trialEndsAt: string | null } | { available: false; reason: "unconfigured" | "unavailable" }> {
  const base = process.env.AXORA_BILLING_API?.trim().replace(/\/$/, ""), token = process.env.AXORA_BILLING_TOKEN;
  if (!base || !token) return { available: false, reason: "unconfigured" };
  try {
    const url = new URL(base);
    const localQa = process.env.AXORA_ALLOW_LOCAL_BILLING === "1" && ["127.0.0.1", "localhost"].includes(url.hostname);
    if ((url.protocol !== "https:" && !localQa) || url.username || url.password || url.hash || url.search) throw new Error("invalid_endpoint");
    const response = await fetch(`${base}/sites/${encodeURIComponent(siteId)}/billing`, { headers: { Authorization: `Bearer ${token}`, Accept: "application/json" }, redirect: "error", cache: "no-store", signal: AbortSignal.timeout(8000) });
    if (!response.ok) throw new Error("billing_unavailable");
    const text = await response.text();
    if (text.length > 1000000) throw new Error("billing_too_large");
    const data = billingSchema.parse(JSON.parse(text));
    if (data.site_id !== siteId || (data.subscription.status === "trial" && !data.confirmed_delivery_at)) throw new Error("billing_binding_invalid");
    return { available: true, data, trialEndsAt: data.confirmed_delivery_at ? new Date(Date.parse(data.confirmed_delivery_at) + CUSTOMER_PRICING.trialDays * 86400000).toISOString() : null };
  } catch { return { available: false, reason: "unavailable" }; }
}
