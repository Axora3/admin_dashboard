# AXORA — Advanced SaaS Management Expansion: implementation report

Extends the existing platform (sections 19–27). No new project, no redesign, no table drops,
no business-data migration. Supabase = platform management, Google Sheets = store business data,
Next.js server = integration layer.

## Inspection (what already existed)

The previous phase had already built: multi-role auth (Super Admin / Store Admin) with server-side
assignment and async-local store scoping, platform tables + RLS (0006), real Sheets health checks,
scheduler (`/api/jobs`), notifications with read state and preferences, subscription plans with
server-side limit enforcement, private-bucket backups with checksum + pre-restore backup, and
reports with CSV export.

Live database (read-only probe, 2026-11-08): 0006 applied, 1 Super Admin profile, 0 stores,
0 Store Admins, `axora-backups` bucket private. `platform_billing_events` does **not** exist yet
(0007 not applied). No Google service account configured → Sheets runs in the labelled local emulator.

## Gaps found and fixed

| Area | Problem | Fix |
|---|---|---|
| Data integrity | `platformStats` counted unreadable stores as 0 | Read failures are reported as unavailable, never zero |
| Health | Unconfigured store reported `error`; `platformHealth()` threw on Supabase outage | `disconnected` status; Supabase outage renders as Error; 1 bounded retry for transient failures |
| Admins | No revoke; reassignment `.update()` silently no-op without a row | `revoke` (fail-closed: profile flag → assignment delete → ban, email confirmation); assignment upsert |
| Notifications | Raw codes (`admin.create`) as titles; failed ops titled as success; no backup-failure / reconnection notices; no Store Admin badge; polling only | Central title rules; failure labelling; reconnection + disconnect notices; badge in Store Admin nav; Supabase Realtime (RLS-scoped) + polling fallback |
| Permissions | Flat list | Role matrix incl. future `store_manager`/`store_staff` (modelled, denied, hidden); every Store Admin page read is permission-checked |
| Analytics | No platform comparison, status distribution, customer activity, product share | Added, plus range presets and product-ranking CSV; revenue never summed across currencies |
| Store overview | Duplicated widgets; no daily+monthly; raw connection string | New overview (all-time totals, 30-day daily, 12-month monthly, inventory, best sellers); simple connection indicator + plain warning |
| Health Center | No global summary, Google API errors, retry status, subscription consistency | All added; diagnostics show codes only, no secrets |
| Subscriptions | No extend/suspend/reactivate; no usage vs limit; features hardcoded | Quick actions via the existing audited RPC; real usage per store (unavailable ≠ 0); `FEATURE_CATALOG`; billing history; payment adapter registry (none registered) |
| Backups | Generic `backup_failed`; no on-demand integrity check | Specific failure codes; "verify integrity" action (checksum + schema + ownership), audited |

## Files changed

- Services/rules: `src/lib/platform/{permissions,health,health-rules,notification-rules,notifications,report-rules,reports,subscription-rules,subscriptions,jobs}.ts`, `src/lib/backup/service.ts`, `src/lib/registry/audit-store.ts`, `src/lib/data/{index,google-repository}.ts`
- Actions/routes: `src/app/admin/actions/{admins,platform}.ts`, `src/app/api/reports/route.ts`
- Pages: admin `analytics`, `admins`, `backups`, `notifications`, `subscriptions`, `system-health`, `dashboard`; store-admin `layout`, `[[...section]]`, `analytics`, `notifications`
- Components: `platform-overview`, `analytics-report`, `notification-center`, `account-form`, `admin-header`, new `health-badge`, `store-overview`, `store-connection-indicator`, `notification-badge`, `use-unread-count`
- Migration: `supabase/migrations/0007_saas_expansion.sql`
- Tests: `scripts/test-saas-expansion.cjs` (wired into `npm run test:platform`)

## Migration 0007 (additive)

- `user_role` enum value `store_manager` (future; app denies sign-in)
- `platform_billing_events` (provider, external reference, status, amount, period — **no card data**), Super Admin read RLS, service-role writes only
- Monitoring indexes
- Adds `platform_notifications` to the `supabase_realtime` publication (RLS from 0006 applies)

**Not applied to the live project.** Apply in the Supabase SQL editor after a backup. Until then
the Subscriptions page shows "run migration 0007" for billing history and the badge falls back to polling.

## Environment variables

No new variables. Existing: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
`SUPABASE_SERVICE_ROLE_KEY`, `AXORA_AUTH_MODE`, `AXORA_APP_URL`, `AXORA_JOB_SECRET`,
`GOOGLE_SERVICE_ACCOUNT_EMAIL` + `GOOGLE_PRIVATE_KEY` (or `GOOGLE_SERVICE_ACCOUNT_JSON`).

## Verification performed

- `npm run typecheck` — pass
- `npm run test:platform` — 19/19 pass (11 existing + 8 new: role matrix, health status rules, subscription consistency, notification titles/visibility, notification store scoping, store analytics, cross-currency comparison, expiry extension)
- `npm run test:security` — 7/7 pass
- `next build` — pass; client bundles contain no service-role, Google key, job secret or `spreadsheetId` identifiers
- Running server: all `/admin/*` and `/store-admin/*` pages redirect unauthenticated users to login; `/api/notifications`, `/api/reports` → 401; `/api/jobs` → 401 without/with wrong secret

## Not verified / requires external configuration

- Authenticated UI was **not** exercised in a browser: no test credentials are available, and the live project has no stores or Store Admins.
- Real Google Sheets connection tests: needs a service account and shared spreadsheets (currently local emulator).
- Realtime badge updates: needs 0007 applied.
- Two-store isolation end-to-end, emailed password recovery, revoke while signed in, and a live backup → restore on a real spreadsheet should be run on staging before production.
- A dedicated platform-wide configuration backup (registry/plans/subscriptions as its own backup kind) is not implemented; per-store snapshots carry that store's configuration in a separate `configuration` section, without credentials or spreadsheet IDs.
- Payment gateways (QPay, bank) — abstraction only, by design.
