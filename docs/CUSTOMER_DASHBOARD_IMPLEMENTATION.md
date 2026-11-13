# Customer dashboard implementation

Updated 2026-11-10. Repository: Axora3/admin_dashboard (application directory `admin_dashboard/`). This application remains independent of Axora. No other repository was edited for this task. Status: **implemented and locally verified; not production-ready**.

## Architecture and authorization

Supabase Auth identifies an active `profiles.role=store_admin` user. Each request loads server-side site memberships, filters inactive sites, and resolves a validated `axora_active_site` cookie. The cookie selects a membership; it grants no authority. An explicit disabled membership overrides legacy `admin_assignments`. Owners manage content and site modules, editors manage content, viewers read only. Super-admin customer API access requires an explicit existing site and remains privileged.

`GET/POST/PATCH/DELETE /api/admin/site-data/:module?siteId=<selected-site>` resolves the spreadsheet exclusively from the registry. A different supplied site ID is rejected, including an otherwise authorized site selected in a stale browser tab. Arbitrary spreadsheet IDs and protected record fields in payloads are rejected. Mutations require matching Origin, bounded JSON, server-side schemas and role/module checks. Audits contain action/resource IDs and mode, not submitted customer payloads or credentials. Private integration IDs and keys are absent from customer configuration responses.

Membership writes use the super-admin-only `POST /api/admin/site-memberships` endpoint: `{siteId,userId,role,status}`. `userId` must identify an active store-admin profile; role is owner/editor/viewer and status active/disabled. Membership administration has an API, **no dedicated customer invitation UI**. Existing owner metadata is descriptive; membership grants access.

## Business modules

| Business | Customer modules | Data storage |
|---|---|---|
| Online store | Products, categories, orders, customers, inventory, discounts | Corresponding site spreadsheet |
| Restaurant / coffee | Menu, categories, orders, reservations, opening hours | Corresponding site spreadsheet |
| Service | Services, appointments, staff, availability; customers when enabled | Corresponding site spreadsheet |
| Business profile | Pages, gallery, articles, contact inquiries | Corresponding site spreadsheet |
| Portfolio | Projects, project categories, gallery | Corresponding site spreadsheet |

The customer catch-all route renders schema-specific forms with Mongolian labels, loading/error/empty/success states, search and pagination. Legacy delivery, analytics and notification routes remain. E-commerce delivery and analytics screens are guarded from other business types. The teal/slate visual identity remains; local Inter fonts support Cyrillic. HTTPS media URLs are supported; this change adds no asset-upload service.

Inventory edits update actual `Products.stock`; the Inventory sheet remains a separate journal. Automatic journal reconciliation and a transactional stock adjustment workflow are **not completed**. Discount records have CRUD but are **not automatically applied to storefront checkout**. Availability records have CRUD but are **not a booking-conflict or capacity engine**. Order payment state cannot be manually set through customer CRUD. Creating or editing an order does not collect or confirm payment.

## Sheets adapter and configuration

`customer/data.ts` calls `google/site-data-service.ts` and the typed adapter. Canonical per-business schemas live in `google/schema-registry.ts`; e-commerce's existing tab/column mappings are honored by `customer/schema.ts`. Explicit empty enabled_modules disables resources. Unsupported business modules are rejected. Inventory requires Products enabled.

Creates use stable UUID record IDs and retained request idempotency keys. Updates require `expectedUpdatedAt`, preserving omitted fields. Deletes require confirmation and are soft deletes. Tests cover false boolean preservation and clearing optional values. Exact header spelling is required; mismatched casing fails explicitly instead of silently reading empty cells. Unknown columns are preserved during updates and schema preparation. Do not treat row numbers as public identifiers.

Owner settings can explicitly prepare missing tabs/columns and missing technical ID/UpdatedAt cells. Business values are not rewritten; preparation caps each table at 1,000 existing rows and may partially prepare preceding tabs before a later failure. This is additive compatibility preparation, not proof that old data formats are valid. Back up and validate legacy JSON/list formats on staging first. Missing schemas remain visible errors until prepared.

Successful CRUD clears this process's published-data and legacy repository caches and revalidates the corresponding internal storefront layout. Public published projections have a 15-second process cache and a response cache budget up to 30 seconds. Other instances and independently deployed websites are **not synchronously invalidated by Next.js path revalidation**. External websites must fetch the site/domain-scoped public API with a bounded cache (or implement their own authenticated revalidation hook). The actual independently deployed customer website flow remains unverified.

Public reads expose only selected published fields. Public create-only intake is origin/site scoped, validated and rate limited. Origin is a routing/abuse constraint for public data, not a secret or membership credential. No public update/delete endpoints exist. Browser-supplied X-Axora-Site-Id, when present, must match the origin-resolved site. Private customer/admin operations always require membership.

Google credentials remain server-side. The existing Sheets client uses OAuth service-account tokens, timeouts, cached tokens and bounded quota/server-error retries. Adapter errors return safe messages. Google Sheets is not a transactional database: direct human edits bypass application locks, and uncertain writes/timeouts require reconciliation before blind retries. Multi-instance production uses existing Supabase platform locks; the local emulator uses local locking only. The current rate limiter is process-local and needs a shared implementation before multi-instance production use.

## Subscription source

`customer/billing.ts` is a read-only adapter for AXORA, with exact site_id response binding, HTTPS server requests, timeout and schema validation. Prices shown are 20,000 MNT/month and 228,000 MNT/year (5% saving against twelve monthly payments). The 30-day trial date is computed only from `confirmed_delivery_at`; AXORA supplies the actual status, plan, next billing date and payment history. Missing/unavailable integration is displayed as unverified, never as a paid or active subscription. No payment success, payment collection, billing mutation or local subscription fallback was added. See `AXORA_BILLING_CONTRACT.md`.

## Setup and rollout

1. Use a staging Supabase project; apply existing migrations in order, then `0008_customer_site_memberships.sql`. It adds authorization metadata and RLS only; it does not migrate business records from Sheets. This task **did not apply the migration**.
2. Create active Supabase customer profiles through the existing admin process, then assign site memberships using the privileged API. Existing legacy assignments remain compatible during migration. Explicit disabled membership records revoke legacy access.
3. Configure the authorized site's registry record: unique ID, owner metadata, canonical business type, tabs/mappings, enabled modules, spreadsheet mapping. Customers do not enter spreadsheet IDs.
4. Configure server credentials, share only the intended spreadsheet with the service account, and explicitly set Sheets mode to google. Validate legacy schemas on staging before preparation. Do not use the local-auth fallback for customer production.
5. Configure the real AXORA billing endpoint and token, and implement its response contract in AXORA through a separately authorized change. No AXORA repository changes were made here.
6. Run real user A/B RLS checks, Google CRUD and independently deployed website refresh tests before rollout.

## Environment

| Variable | Use | Browser-safe? |
|---|---|---|
| NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY | Supabase user auth | Yes; RLS must enforce access |
| SUPABASE_SERVICE_ROLE_KEY | Privileged membership/config lookup | **No** |
| AXORA_AUTH_MODE=supabase | Customer identity provider | Server setting |
| AXORA_PLATFORM_STORAGE=supabase | Metadata, audit and operation locks | Server setting |
| AXORA_SHEETS_MODE=google | Force actual Sheets backend | Server setting |
| GOOGLE_SERVICE_ACCOUNT_JSON | Service account JSON; alternative to next two variables | **No** |
| GOOGLE_SERVICE_ACCOUNT_EMAIL / GOOGLE_PRIVATE_KEY | Service account identity and PEM | **No** |
| GOOGLE_PRIVATE_KEY_ID | Optional key identifier | Server setting |
| AXORA_BILLING_API / AXORA_BILLING_TOKEN | AXORA source API and server bearer token | **No token exposure** |
| AXORA_APP_URL / ADMIN_HOST | Canonical dashboard origin/host | Deployment settings |
| AXORA_DATA_DIR | Isolated local emulator persistence | Development only |
| AXORA_DIST_DIR | Isolated test build directory | Test/build only |
| AXORA_ALLOW_LOCAL_BILLING=1 | Explicit loopback-only billing fixture override | Test only; omit in production |

Never prefix secrets with NEXT_PUBLIC_. Never commit local environment values. Environment presence is not successful integration verification.

## Prioritized remaining roadmap

1. **High**: apply/test membership migration on staging; verify real Supabase Auth and RLS denial for A→B reads/writes/revoked memberships. Dependency: staging Supabase access.
2. **High**: provision five staging site spreadsheets, validate legacy mappings/formats, run real CRUD with service-account permissions and capture before/after evidence. Dependency: Google credentials and explicit staging spreadsheets.
3. **High**: connect actual customer deployments; verify product/menu/service/page updates appear within the documented cache budget, then add shared invalidation/webhooks if faster propagation is required. Dependency: website deployment/access and matching adapter.
4. **High**: connect AXORA's actual read-only delivery/subscription/payment API. Dependency: authoritative endpoint implementation and server token. Do not infer billing from local assignments.
5. **Medium**: shared rate-limit buckets, distributed cache invalidation and reconciliation for uncertain/partial Google writes; assess direct-sheet editing policy and production quotas.
6. **Medium**: complete transactional inventory journal, storefront discount redemption and booking capacity/conflict rules before advertising these as end-to-end features. Add business-specific UI controls for related-record selection and media upload if required.
7. **Low**: resolve legacy whole-repository lint warnings; add visual screenshot baselines and a membership administration/invitation screen.
