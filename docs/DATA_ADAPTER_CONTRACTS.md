# Data Adapter Contracts

Adapters are server-side and business-type-specific. Shared transport and safety rules do not imply one universal business schema.

## Common rules

```ts
interface RecordBase {
  id: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  idempotencyKey?: string;
  extensions?: Record<string, unknown>;
}

interface SiteDataAdapter<T extends RecordBase> {
  list(siteId: string, filter?: Record<string, unknown>): Promise<T[]>;
  get(siteId: string, id: string): Promise<T | null>;
  create(siteId: string, input: unknown, idempotencyKey: string): Promise<T>;
  update(siteId: string, id: string, expectedUpdatedAt: string, input: unknown): Promise<T>;
  delete(siteId: string, id: string, expectedUpdatedAt: string, confirm: true): Promise<void>;
}
```

- `siteId` is derived from the authenticated membership or verified public domain; it is not trusted by itself from a client body.
- Server-side Zod schemas validate all input. The client cannot choose a tab, header, spreadsheet ID, row number, tenant, or arbitrary column patch.
- `create` is idempotent for `(siteId, resource, idempotencyKey)` and returns the first committed result.
- `update` and `delete` compare `expectedUpdatedAt` under a site/resource operation lock and return a conflict on stale versions. A Sheets read/patch pair is not an atomic compare-and-set against manual edits made directly in Sheets.
- `delete` requires explicit confirmation and records a tombstone plus audit event. Reads hide tombstones by default.
- Google API writes are server-only. Private reads/writes require an authenticated active member with a resource permission.
- Anonymous public reads return a resource-specific published projection only. Anonymous create-only intake is limited to Orders, Reservations, Appointments and ContactInquiries. There is no anonymous list/get/update/delete.
- The current routes return `{ data }` for reads, `{ ok: true, id, createdAt }` for public creates, and generic `{ error }` messages for failures. They do not yet return a revision/ETag or structured retryable code. Raw Google errors, credentials and spreadsheet mapping are not included in API responses; public audit metadata omits visitor PII.

## Typed business records

```ts
interface Product extends RecordBase { name: string; slug: string; price: number; stock: number; categoryId: string | null; isActive: boolean; images: string[]; variants: ProductVariant[] }
interface Category extends RecordBase { name: string; slug: string; description?: string; sortOrder: number }
interface Order extends RecordBase { orderNumber: string; status: string; items: OrderItem[]; totalAmount: number; customerId?: string; fulfillment?: Record<string, unknown> }
interface MenuItem extends RecordBase { name: string; price: number; isAvailable: boolean; categoryId: string | null; allergens: string[]; options: Record<string, unknown>[] }
interface Reservation extends RecordBase { customerName: string; phone: string; partySize: number; reservedAt: string; status: string }
interface Service extends RecordBase { name: string; durationMinutes: number; price?: number; currency?: string; isActive: boolean }
interface Appointment extends RecordBase { serviceId: string; staffId?: string; customerName: string; startsAt: string; status: string }
interface PageContent extends RecordBase { slug: string; title: string; body: string; status: "draft" | "published"; seo?: Record<string, unknown> }
interface GalleryItem extends RecordBase { title: string; mediaUrl: string; status: "draft" | "published"; alt?: string; caption?: string }
interface ContactInquiry extends RecordBase { name: string; email: string; message: string; status: string; subject?: string }
```

`OrderItem`, `ProductVariant`, `Customer`, `Staff`, `Article`, `OpeningHours` and `Settings` are likewise defined by their owning module/schema. Do not reuse `MenuItem` as `Product`, or `Appointment` as `Order`.

## HTTP integration surface

| Caller | Operation | Authorization |
|---|---|---|
| Customer Dashboard | Admin CRUD actions | Supabase-authenticated user + active site membership + permission; site comes from session/selection checked server-side. |
| Website visitor | `GET /api/public/site-data/{module}` | Exact verified active website Origin, active/published site, module allowlist; public-field projection only. |
| Website visitor | `POST /api/public/site-data/{module}` | Verified active website Origin, schema validation, rate limit, idempotency and create-only policy. Server computes price and configured shipping where applicable. |
| Customer Dashboard | `GET/POST/PATCH/DELETE /api/admin/site-data/{module}?siteId=...` | Authenticated admin session and permission. Store admins are always bound to their assigned site; Super Admin site selection is verified against the registry. |
| Generated server component | Optional conditional public GET | Same Origin/domain allowlist and public projection; no secret header. |

Public Origin is not an identity credential. It is checked against the active verified domain allowlist and CORS, while the public methods are constrained to non-sensitive reads or intake creates. Admin CRUD always requires a real session membership check. The public/API response cache and rate limiter are process-local in this increment and need a shared service for multi-instance deployment.

## Template mapping

| Template | Adapter | Required behavior |
|---|---|---|
| online_store_template | `online_store` | Replace direct Apps Script writes with dashboard API for standardized site data, or retain Apps Script only as a versioned legacy adapter with equivalent tenant/auth/idempotency guarantees. Migration must preserve existing OTP/customer/order behavior. |
| online_store_template_2 | `online_store` | Replace source-code catalog and demo webhook order path with public catalog adapter plus create-only order endpoint. |
| coffe_shope_template | `restaurant` | Load menu/categories/opening hours through public adapter; submit orders/reservations through create-only endpoints. Remove local “success” claims. |
| business_profile_template | `business_profile` | Load published pages/gallery/articles/settings; submit contact inquiries through create-only endpoint. |

Each generated website contains only its non-secret site configuration/origin. It never contains a service-account credential or spreadsheet ID.
