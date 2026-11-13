# Customer dashboard gap report

Inspected 2026-11-10 before this implementation. Scope: admin_dashboard only; separate from Axora.

| Severity | Area / evidence | Gap | Planned correction / dependency |
|---|---|---|---|
| High | auth/server.ts, migration 0005 admin_assignments | One user and one customer per site; no multi-site membership selection | Additive site_memberships model, legacy assignment compatibility, validated server selection and per-request membership checks. Apply/test migration separately. |
| High | store-admin/layout.tsx and catch-all page | E-commerce-only navigation/screens; typed Sheets contracts unused by customer UI | Business/module registry and common schema-driven CRUD screens over authorized siteAdapter. |
| High | google/schema-registry.ts | Portfolio, discounts and separate availability resources absent | Business-specific schemas and navigation; preserve configured mappings/legacy tabs. |
| High | api/admin/site-data | Customer input site selection is ignored rather than checked; permissions generic; active-site checks incomplete | Explicit selected-site equality, active membership/role/module gates, safe error/status handling and accurate operation results. |
| High | google/site-data-service.ts | Canonical tabs ignore custom mappings; empty enabled_modules can expand to all modules | Site schema mapping resolution; explicit empty list disables resources. |
| High | Google Sheets / Supabase availability | No real Google/identity/RLS staging evidence in this checkout | Test scoped fixtures/emulator; leave real Google, Supabase RLS and website deployment checks unverified until credentials/site are configured. |
| High | platform/subscriptions.ts and platform_subscriptions | Manual local platform state, no AXORA delivery/payment source | Separate read-only AXORA billing contract; no invented trial, payment or status. |
| Medium | Existing sheet headers | Legacy rows may lack typed common columns/version metadata | Explicit authorized additive schema preparation, stable control metadata only; no automatic destructive migration. |
| Medium | site-data-service / typed-adapter | Updates clear only public projection cache; errors/audit handling incomplete | Invalidate matching legacy/public caches after confirmed writes, revalidate paths, sanitize audit fields. |
| Medium | Registry owner metadata | ownerEmail is descriptive, not a permission | Membership role is authority; owner displayed from authorized registry/member context. |
| Medium | Public order intake | Random order number generated on each retry conflicts with payload idempotency check | Deterministic request-derived order number number; aggregate inventory reservation remains follow-up. |
| Medium | Locale/loading/responsive UI | Existing teal/slate customer design is usable but limited states/modules | Preserve visual language, Mongolian labels/Cyrillic font, explicit loading/empty/error/success states. |

Business records remain in per-site Google Sheets. Supabase additions are identity/authorization metadata only. No production migration/deployment is implied by creating a migration file.
