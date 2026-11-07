import { getCurrentAdmin, requireStoreAdmin } from "@/lib/auth/server";
import { withStoreAdmin } from "@/lib/auth/store-scope";
import { getReports } from "@/lib/platform/reports";
import { enforceLimit } from "@/lib/platform/subscriptions";
import { assertPermission } from "@/lib/platform/permissions";

/** Neutralise spreadsheet formula injection and quote every cell. */
const cell = (value: unknown) => `"${String(value).replace(/^[=+@-]/, "'$&").replace(/"/g, '""')}"`;

export async function GET(request: Request) {
  const admin = await getCurrentAdmin();
  if (!admin) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const query = Object.fromEntries(new URL(request.url).searchParams);
  const kind = query.report === "products" ? "products" : "periods";

  const run = async (storeId?: string) => {
    if (storeId) await enforceLimit(storeId, "write", 0, 0, "reports");
    const result = await getReports(storeId, query);
    // Never export a partial report as if it were complete.
    if (result.unavailable.length) return Response.json({ error: "Report data is incomplete" }, { status: 503 });
    const lines = kind === "products"
      ? ["store_id,currency,rank,product,quantity,orders,paid_revenue,revenue_share", ...result.reports.flatMap(r => r.data.topProducts.map((p, i) => [r.id, r.currency, i + 1, p.name, p.quantity, p.orders, p.revenue, p.share.toFixed(4)].map(cell).join(",")))]
      : ["store_id,currency,period,orders,paid_revenue", ...result.reports.flatMap(r => r.data.buckets.map(b => [r.id, r.currency, b.label, b.orders, b.revenue].map(cell).join(",")))];
    return new Response(lines.join("\r\n"), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename=axora-${kind}-${result.filters.from}-${result.filters.to}.csv`,
        "Cache-Control": "no-store",
      },
    });
  };

  try {
    if (admin.isSuperAdmin) return await run(query.storeId);
    await requireStoreAdmin();
    // The store is always the server-side assignment; any storeId in the query is ignored.
    return await withStoreAdmin(actor => { assertPermission(actor, "analytics.read", actor.storeId); return run(actor.storeId); });
  } catch {
    return Response.json({ error: "Report unavailable or plan does not allow export" }, { status: 403 });
  }
}
