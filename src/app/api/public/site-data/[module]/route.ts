import { clientIp, rateLimit } from "@/lib/rate-limit";
import { createPublicSubmission, publicRead, resolveSiteFromOrigin } from "@/lib/google/site-data-service";
import { z } from "zod";
import { recordPlatformAudit } from "@/lib/registry/audit-store";

type Context = { params: Promise<{ module: string }> };
const idempotencySchema = z.string().uuid();

function cors(origin: string) {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Idempotency-Key, X-Axora-Site-Id",
    "Access-Control-Max-Age": "600",
    Vary: "Origin",
  };
}

export async function OPTIONS(request: Request) {
  const origin = request.headers.get("origin");
  const store = await resolveSiteFromOrigin(origin);
  if (!origin || !store || (request.headers.get("x-axora-site-id") && request.headers.get("x-axora-site-id") !== store.id)) return Response.json({ error: "Origin is not authorized." }, { status: 403 });
  return new Response(null, { status: 204, headers: cors(origin) });
}

export async function GET(request: Request, context: Context) {
  const origin = request.headers.get("origin");
  const store = await resolveSiteFromOrigin(origin);
  if (!origin || !store || (request.headers.get("x-axora-site-id") && request.headers.get("x-axora-site-id") !== store.id)) return Response.json({ error: "Origin is not authorized." }, { status: 403 });
  const { module } = await context.params;
  const ip = await clientIp();
  if (!rateLimit(`public-sheet-read:${store.id}:${module}:${ip}`, 120, 60_000).allowed) {
    return Response.json({ error: "Please wait before requesting this resource again." }, { status: 429, headers: cors(origin) });
  }
  try {
    const data = await publicRead(store, module);
    return Response.json({ site_id: store.id, data, site: { name: store.name, businessType: store.businessType, currency: store.currency, language: store.language } }, {
      headers: { ...cors(origin), "Cache-Control": "public, max-age=0, s-maxage=15, stale-while-revalidate=15" },
    });
  } catch {
    return Response.json({ error: "Published site data is temporarily unavailable." }, { status: 503, headers: { ...cors(origin), "Cache-Control": "no-store" } });
  }
}

export async function POST(request: Request, context: Context) {
  const origin = request.headers.get("origin");
  const store = await resolveSiteFromOrigin(origin);
  if (!origin || !store || (request.headers.get("x-axora-site-id") && request.headers.get("x-axora-site-id") !== store.id)) return Response.json({ error: "Origin is not authorized." }, { status: 403 });
  const { module } = await context.params;
  const ip = await clientIp();
  const limit = rateLimit(`public-sheet-create:${store.id}:${module}:${ip}`, 5, 60_000);
  if (!limit.allowed) return Response.json({ error: "Please wait before submitting again." }, { status: 429, headers: { ...cors(origin), "Retry-After": String(limit.retryAfterSeconds) } });
  const idempotencyKey = idempotencySchema.safeParse(request.headers.get("idempotency-key"));
  if (!idempotencyKey.success) return Response.json({ error: "A valid Idempotency-Key is required." }, { status: 400, headers: cors(origin) });
  if (Number(request.headers.get("content-length") ?? 0) > 20_000) return Response.json({ error: "Request is too large." }, { status: 413, headers: cors(origin) });
  let body: unknown;
  try { body = await request.json(); } catch { return Response.json({ error: "Request body must be valid JSON." }, { status: 400, headers: cors(origin) }); }
  try {
    const result = await createPublicSubmission(store, module, body, idempotencyKey.data);
    try {
      await recordPlatformAudit({ actorUserId: null, actorName: "Public visitor", storeId: store.id,
        action: "site_data.public_created", resourceType: module, resourceId: result.id,
        metadata: { source: "verified_site_origin" },
      });
    } catch { console.error("[axora] public sheet submission audit write failed"); }
    return Response.json({ ok: true, ...result }, { status: 201, headers: { ...cors(origin), "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof Error && error.name === "IdempotencyConflictError") {
      return Response.json({ error: "This request key was used for different input." }, { status: 409, headers: { ...cors(origin), "Cache-Control": "no-store" } });
    }
    if (error instanceof z.ZodError || (error instanceof Error && /invalid|unavailable|not accept|not enabled/i.test(error.message))) {
      return Response.json({ error: "Submission is invalid or unavailable." }, { status: 400, headers: { ...cors(origin), "Cache-Control": "no-store" } });
    }
    return Response.json({ error: "Submission service is temporarily unavailable." }, { status: 503, headers: { ...cors(origin), "Cache-Control": "no-store" } });
  }
}
