import { z } from "zod";
import { authorizeCustomer, customerFailure, customerJson } from "@/lib/customer/access";
import { readCustomerModule, mutateCustomerRecord } from "@/lib/customer/data";
import { sheetsMode } from "@/lib/config";
export const runtime = "nodejs";
type Context = { params: Promise<{ module: string }> };
const id = z.string().regex(/^[a-zA-Z0-9_-]{1,128}$/);
const create = z.object({ payload: z.record(z.string(), z.unknown()), idempotencyKey: z.string().uuid() }).strict();
const update = z.object({ id, expectedUpdatedAt: z.string().datetime(), payload: z.record(z.string(), z.unknown()) }).strict();
const remove = z.object({ id, expectedUpdatedAt: z.string().datetime(), confirmed: z.literal(true) }).strict();
export async function GET(request: Request, context: Context) {
  try { const { module } = await context.params; const { actor, store } = await authorizeCustomer(request, module); return Response.json({ site_id: store.id, data: await readCustomerModule(actor, store, module), mode: sheetsMode() }, { headers: { "Cache-Control": "no-store" } }); }
  catch (error) { return customerFailure(error); }
}
async function mutate(request: Request, context: Context, operation: "create" | "update" | "delete") {
  try {
    const { module } = await context.params;
    const { actor, store } = await authorizeCustomer(request, module, true);
    const body = await customerJson(request);
    const input = operation === "create" ? create.parse(body) : operation === "update" ? update.parse(body) : remove.parse(body);
    const result = await mutateCustomerRecord(actor, store, module, operation, input);
    return Response.json({ ok: true, data: result.record, mode: result.mode, auditWarning: result.auditWarning,
      message: (result.mode === "local" ? "Локал эмуляторт хадгаллаа. Google Sheets-д бичээгүй." : "Google Sheets-д хадгаллаа.") + (result.auditWarning ? " Үйлдлийн түүхийн баталгаажуулалт хүлээгдэж байна." : "") },
      { status: operation === "create" ? 201 : 200, headers: { "Cache-Control": "no-store" } });
  } catch (error) { return customerFailure(error); }
}
export async function POST(request: Request, context: Context) { return mutate(request, context, "create"); }
export async function PATCH(request: Request, context: Context) { return mutate(request, context, "update"); }
export async function DELETE(request: Request, context: Context) { return mutate(request, context, "delete"); }
