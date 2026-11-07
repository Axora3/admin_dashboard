# AXORA — Platform Enhancement & Production Readiness

> Consolidated implementation brief: includes the eight requested enhancement modules and the strict Supabase / Google Sheets responsibility boundary. This document describes required work, not a claim that those features are already implemented.

## PROJECT CONTEXT

I already have an existing AXORA website built with Next.js and connected to Supabase.

Do NOT create a new project.

Your task is to inspect the existing codebase, understand the current architecture, and improve it into a professional multi-tenant e-commerce SaaS platform.

Preserve the existing UI design, working features, routing, and Supabase connection wherever possible.

Do not perform destructive changes without first identifying their impact.

## 1. Architecture — Keep Responsibilities Separate

AXORA uses three main layers:

### A. Supabase

Use Supabase for:
- Authentication
- User profiles
- Super Admin and Store Admin roles
- Store registry
- Store-to-admin relationships
- Google Sheets connection metadata and server-only spreadsheet mappings (never credentials in public rows)
- Domain mapping
- Audit logs
- Backup metadata
- Subscription plans and billing metadata
- System configuration

### B. Google Sheets

Each store has its own separate Google Spreadsheet.

Google Sheets remains the source of truth for store business data:
- Products
- Categories
- Orders
- Customers
- Inventory
- Store settings

Do not merge every store's business data into shared Supabase product or order tables.

If the existing project already stores business data in Supabase, first inspect it and report the current architecture. Do not delete or migrate existing data automatically. Propose a safe migration plan and wait for approval before making destructive changes.

### C. Next.js Server

All sensitive operations must run server-side:
- Google Sheets API
- Store access validation
- Role authorization
- Data synchronization
- Backup operations
- Audit logging

Never expose service credentials or Google private keys to the browser.

Keep Google private keys and Supabase privileged keys in server environment variables or a managed secret store. Store only secret references in integration metadata. Protect spreadsheet IDs, URLs, tab/column mappings and secret references with privileged server access. Store Admin receives only sanitized connection status and synchronization timestamps.

Use Supabase private object storage (or equivalent protected object storage) for backup payloads. Supabase database tables store backup metadata and object references, not live copies of all store products/orders. Backups are recovery artifacts, never a second live source of truth.

Store-facing business settings remain in each store's Settings sheet. Platform-only configuration—domain mapping, plan assignment, access suspension, integration mapping, backup schedule—belongs in Supabase. Avoid two independently writable copies of the same setting.

The current project may use local file adapters for registry, audit and other metadata. Inspect these and the live identity-only Supabase bootstrap before migrating. Prepare additive migrations, preserve existing IDs and relationships, backfill and verify records, then switch adapters with a rollback path. Do not blindly replay legacy SQL migrations that create central business tables.

## 2. Role-Based Access Control

Implement two active roles now: Super Admin and Store Admin. Prepare extensible permissions for Store Manager and Store Staff, but do not enable unfinished roles.

### Super Admin
- Access every store.
- Create and manage stores.
- Create and manage Store Admin accounts.
- View global analytics.
- Manage Google Sheets connections.
- View all audit logs.
- Manage backup and restore.
- Manage domains.
- Manage subscription plans.
- Configure platform settings.

### Store Admin
- Access only their assigned store.
- Manage products and categories.
- Manage orders and customers.
- View store analytics.
- Manage permitted store settings.
- View their own store's connection status.
- View their own store's audit history.

### Store Manager and Store Staff (future-ready)
Prepare a permission architecture for:
- Order management
- Product management
- Customer support
- Read-only access

Do not expose Store Manager or Store Staff functionality until it is implemented.

Initially, enforce exactly one platform owner and at most one primary Store Admin per store. New-store onboarding must create/assign its primary Admin, or display an explicit incomplete-onboarding state with a retry path. Account provisioning failures must not silently activate a store as fully ready.

Use a membership/permission model that can later support multiple members without rewriting every endpoint. Keep server-side permission checks explicit (for example products.read, products.write, orders.update, analytics.read). A subscription entitlement never grants permissions the authenticated account does not have.

After login:
- super_admin → /admin
- store_admin → /store-admin

Account deactivation must deny subsequent requests even when an existing session token has not expired. Store suspension and membership changes must also be rechecked server-side.

## 3. Supabase Security

Inspect and improve:

- Supabase Auth configuration
- Role management
- Row Level Security (RLS)
- Database policies
- Server-side authorization
- Session validation
- Password reset flow
- Account activation and deactivation
- Protected admin routes

Every sensitive API endpoint must verify the authenticated user and their role.

Store Admin must never be able to access another store by changing a URL, request parameter, Store ID, or API payload.

Do not trust role or Store ID values supplied by the frontend.

Use server-verified account and store membership information.

Keep Supabase service role keys server-side only.

## 4. Admin Management

Create a complete Admin Management module for Super Admin.

Features:
- Create Store Admin account.
- Assign Admin to a store.
- Edit Admin profile.
- Activate / deactivate account.
- Trigger secure password reset.
- View last login.
- View account creation date.
- View Admin activity.
- Revoke access.

Use Supabase Auth for account authentication.

Do not store plaintext passwords.

An Admin must not be able to register themselves publicly.

## 5. Store Management

Improve the existing store management module.

Each store should have:
- Store ID
- Store name
- Business type
- Custom domain
- Assigned Store Admin
- Google Spreadsheet reference
- Sheet mapping
- Connection status
- Store status
- Subscription plan
- Creation date

Add:
- Search
- Filters
- Sorting
- Pagination
- Store details
- Store activation/deactivation
- Store configuration

## 6. Google Sheets Integration

Create a reusable Google Sheets service layer.

Features:
- Connect a spreadsheet.
- Validate spreadsheet access.
- Detect sheet tabs.
- Validate required columns.
- Configure column mapping.
- Read store data.
- Write store data.
- Handle API quota limits.
- Handle timeouts and errors.
- Track last successful synchronization.
- Display connection health.

Each store must use its own spreadsheet mapping.

Never allow Store Admin to choose another store's spreadsheet.

Do not expose Spreadsheet IDs, URLs, credentials or integration mappings in Store Admin HTML, React Server Component payloads, API responses, downloads, notifications, audit views or raw error messages. Merely hiding a form field is insufficient.

Prevent the same spreadsheet from being accidentally assigned to multiple stores. A failed access/mapping test must not mark the connection as healthy or replace a previously working configuration. Stage connection changes and commit only after validation.

## 7. Advanced Analytics

### Global Super Admin Analytics

Show:
- Total stores
- Active stores
- Total orders
- Total products
- Total sales
- Store growth
- Store connection health
- Subscription distribution

### Store Admin Analytics

Show:
- Total sales
- Total orders
- Average order value
- Best-selling products
- Daily sales
- Monthly sales
- Order status distribution
- Inventory overview

Analytics must use the correct store's data.

Clearly indicate the date range and the last successful data refresh time.

Do not fabricate sales data or display fake metrics.

Define sales consistently: show paid revenue separately from unpaid order value, account for refunds/cancellations, and do not sum different currencies without an explicit conversion policy. Default reporting timezone is Asia/Ulaanbaatar; comparisons use equivalent periods. Define how zero-volume previous periods are displayed.

Global totals must identify stores whose data is unavailable. Never present a partial total as a complete live total. Show cache/refresh timestamps and distinguish zero activity from a failed data fetch.

## 8. Notification Center

Create a notification system.

Notification types:
- New order
- Google Sheets connection failure
- Backup failure
- Successful backup
- Domain verification issue
- Admin account changes
- Subscription status changes

Requirements:
- Read/unread status
- Notification history
- Notification timestamps
- Store association
- Role-based visibility
- Mark as read
- Notification preferences

Store Admin sees only notifications related to their store and permitted role. Membership alone does not expose platform-only account/security events.

Persist notification events and per-recipient read state separately. Marking a notification as read must not mark it read for everyone. Use event IDs/deduplication keys and bounded retries so polling or job retries do not create duplicate notifications.

Detect orders written directly into Sheets through scheduled polling with durable per-store cursors. Deduplicate against orders created through AXORA. Acknowledge that Sheets polling is not instant delivery; show the last check time.

Implement in-app notifications in this phase: header bell, unread count, recent items, full history and preferences. Prepare email/SMS adapters for a later phase without pretending messages were delivered.

## 9. System Monitoring

Create a System Health page for Super Admin.

Monitor:
- Supabase connection
- Google Sheets connection per store
- Last successful synchronization
- Google API errors
- API response failures
- Backup status
- Domain verification status
- SSL status
- Scheduled task execution

Show clear statuses:
- Healthy
- Warning
- Error
- Disconnected

Include useful error details without exposing secrets.

Use actual checks and observed events, not static healthy badges. Record checked_at, last_success_at, error category, latency and next retry where applicable. A check that has never run must appear as Not checked/Unknown. A missed scheduler heartbeat must become a warning/error instead of remaining healthy.

Store Admin may see only their own sanitized connection summary. Full system monitoring, Supabase diagnostics and cross-store errors are Super Admin-only. Provide authorized retry/check actions with rate limits and audit records.

## 10. Audit Log

Record important operations:

- Login events
- Store creation and updates
- Admin account changes
- Product changes
- Order status changes
- Google Sheets connection changes
- Domain changes
- Backup and restore operations
- Subscription changes

Record:
- Actor ID
- Actor role
- Store ID
- Action
- Entity
- Record reference
- Timestamp
- Operation status

Store Admin can only see their own store's permitted audit history.

Super Admin can see platform-wide logs.

Do not log passwords, private keys, access tokens, or unnecessary sensitive personal data.

Audit records should be append-only through application interfaces. Neither Store Admin nor routine Super Admin UI should edit historical events. Retention/deletion, if required, uses a separate privileged policy and is itself audited.

Minimize customer personal data in change snapshots. Separate restricted platform/integration events from store-visible events and sanitize metadata server-side. Record both successful and failed mutations without logging secrets.

## 11. Backup & Recovery

Implement:
- Scheduled backup per store
- Manual backup
- Backup history
- Backup integrity verification
- Backup metadata
- Restore preview
- Restore confirmation
- Pre-restore backup
- Restore result verification
- Audit logging

Backups must be stored separately from the original Google Sheets.

Restore must affect only the selected store.

Do not delete or overwrite data without confirmation.

If restore fails partially, report the failure clearly and provide a safe recovery procedure.

Start with daily automatic backups per active store, plus manual backups. Make schedule/timezone and retention configurable. Use authenticated scheduled execution, durable job state, per-store locking and duplicate-run protection. Backups must continue when no dashboard tab is open.

Use private storage with per-store object namespaces, checksums, schema/mapping version, source reference, timestamps, size, row counts and operation state. Do not expose backup objects publicly or include credentials. Validate a backup before listing it as restorable.

Restore is Super Admin-only. Preview the selected store, backup timestamp and affected tabs/row counts; require explicit confirmation. Verify ownership, checksum and mapping compatibility server-side. Create and verify a pre-restore backup, block conflicting AXORA writes, restore only the selected store, verify results and invalidate caches. Detect concurrent external Sheets edits where possible; explain that Sheets does not provide a multi-tab transaction.

On partial failure, preserve the pre-restore snapshot and operation state, report which steps completed, and offer a controlled rollback/retry. Never claim success until verification completes. Apply retention cleanup only after a new successful backup and never remove the only recoverable snapshot.

## 12. Subscription Architecture

Prepare a subscription management system.

Example plans:
- Basic
- Pro
- Business

Each plan may define:
- Maximum products
- Maximum orders
- Number of Admin accounts
- Available features
- Storage limits
- Support level
- Subscription duration

Super Admin can:
- Assign a plan.
- Change a plan.
- Extend expiration.
- Suspend a subscription.
- View subscription history.

Do not implement fake payment success.

Prepare the architecture for future payment provider integration without requiring payment integration in this phase.

Implement real manual plan assignment now; payment collection is explicitly deferred. Do not invent prices, invoices, paid status, payment buttons or successful transactions. Basic, Pro and Business are configurable plan definitions; business limits/prices must not be silently assumed.

Keep plan definitions, feature entitlements, store subscriptions and subscription history in Supabase. Prepare separate provider-customer, provider-subscription, invoice and webhook references as nullable metadata for later integration. Do not store card data.

Define subscription states such as trialing, active, expired, suspended and cancelled, plus start/end dates and an optional explicit grace period. Keep subscription status distinct from store status and Admin account status. Display the effective access restriction and its reason.

Specify the time window for quotas such as orders per month and the unit for backup storage. Enforce applicable limits server-side across all relevant write entry points; frontend labels alone are insufficient. Treat usage counters as derived, reconcilable metadata, not a second order/product database. Account for direct Sheets edits and concurrent requests.

Plan changes must be audited and versioned. Downgrades must not delete existing products, orders or accounts. Warn about over-limit usage and restrict only the explicitly defined future operations. Expiration must not silently delete data. Document the selected expired/read-only behavior before enabling enforcement.

Store Admin can view their own plan, expiry and usage if enabled, but cannot modify plan definitions, assign subscriptions or access another store's billing metadata. Future payment adapters must support verified signatures, idempotent events and reconciliation without changing the business-data architecture.

## 13. Custom Domain Management

Improve:
- Domain registration
- Domain verification
- DNS status
- SSL status
- Primary domain
- Domain-to-store mapping

A domain must resolve to exactly the intended store.

Prevent one domain from being assigned to multiple active stores.

## 14. UX / UI Improvements

Keep the existing AXORA visual identity.

Improve:
- Responsive admin layout
- Sidebar navigation
- Store switcher
- Search and filters
- Tables
- Pagination
- Loading states
- Empty states
- Error states
- Confirmation dialogs
- Toast notifications
- Form validation
- Accessible controls

Use consistent design tokens and reusable components.

Do not replace the current design with generic dashboard templates.

Super Admin and Store Admin must have visually distinct dashboards while sharing a consistent design system.

## 15. Reliability & Performance

Implement:
- Server-side pagination where applicable
- Controlled caching
- Cache invalidation after data changes
- Google API rate-limit handling
- Request timeouts
- Retry with safe limits
- Idempotency for sensitive write operations
- Input validation
- Error boundaries
- Structured server logging

Never assume that a Google Sheets write succeeded until the API confirms it.

For concurrent updates, prevent accidental overwrites where possible.

Do not let a cache show outdated data as if it were live.

## 16. Suggested Supabase Structure

Inspect existing tables before creating anything.

Possible tables:

- profiles
- stores
- store_members
- store_integrations
- store_domains
- audit_logs
- backup_metadata
- subscriptions
- subscription_history
- notifications

Use appropriate foreign keys, unique constraints, indexes, and RLS policies.

These tables are for platform management and configuration, not for duplicating all store business data.

Do not create duplicate tables if equivalent tables already exist.

## 17. Development Workflow

Before coding:

1. Inspect the complete repository.
2. Inspect existing Supabase configuration.
3. Inspect database schema and migrations.
4. Inspect current authentication.
5. Inspect existing routes and components.
6. Identify existing features and incomplete functionality.
7. Identify security issues.
8. Produce a short implementation plan.

Then implement in small phases.

For every phase:
- Explain what will change.
- Preserve working features.
- Make safe migrations.
- Test permissions.
- Test store isolation.
- Test Google Sheets integration.
- Report changed files.
- Report environment variables required.
- Report commands to run.
- Report any manual Supabase configuration.

Do not silently change the database architecture.

Do not expose secrets in logs or source code.

## 18. Final Acceptance Criteria

The implementation is complete only when:

1. Super Admin can manage every store.
2. Each store has its own Store Admin.
3. Store Admin cannot access other stores.
4. Supabase RLS and server-side authorization are verified.
5. Each store reads from its own Google Sheets.
6. Google Sheets connection tests work.
7. Audit logs record important actions.
8. Backup and restore work safely.
9. Custom domains resolve to the correct stores.
10. Analytics use real data.
11. Notifications respect store permissions.
12. Existing website functionality remains intact.
13. Super Admin overview includes real revenue, orders, store activity, connection health and recent Admin actions.
14. Separate Store Admin dashboards enforce both role and ownership on every read/write path.
15. Manual Basic/Pro/Business assignment, expiry, history and server-side entitlements work without payment integration.
16. Monitoring distinguishes healthy, failed, stale and never-checked states using real checks.
17. Scheduled backups and notification polling run without a browser session, with retry/deduplication verified.
18. Store Admin cannot obtain private integration identifiers, credentials or platform-only logs through alternate responses.
19. No centralized Supabase business-data tables are introduced, and any metadata migration preserves existing stores/accounts.
20. Required external configuration and unverified production behaviors are explicitly listed; passing a build alone is not production readiness.

Prioritize security, data isolation, reliability, and maintainability over adding unnecessary features.

## 19. Required Dashboard Experiences and Routes

### Super Admin overview

Improve the existing /admin dashboard with:
- Total/active stores, paid revenue, order volume, product count and store growth.
- Date-range filter and authorized All Stores / single-store selector.
- Sales/order trends, top-performing stores and products.
- Recent orders and recent Admin activity.
- Sheets connection failures and stale synchronization warnings.
- Last/next backup and failed backup alerts.
- Subscription distribution and upcoming expirations.
- Clear drill-down links and partial-data indicators.

### Store Admin workspace

Provide a visually distinct store-scoped workspace with:
- Own-store revenue, orders, top products and inventory summary.
- Product/category CRUD and order status management.
- Customer views, daily/monthly analytics and permitted Settings-sheet changes.
- Own sanitized connection status, allowed audit history and notifications.
- No platform store selector, integration editor, credential fields, backup restore controls or subscription assignment controls.

Reuse existing routes where equivalent routes already exist. Suggested additions:

```text
/admin
/admin/stores
/admin/admins
/admin/analytics
/admin/system-health
/admin/notifications
/admin/subscriptions
/admin/backups
/admin/domains
/admin/audit-logs
/admin/settings

/store-admin
/store-admin/products
/store-admin/categories
/store-admin/orders
/store-admin/customers
/store-admin/analytics
/store-admin/settings
/store-admin/notifications
/store-admin/audit-logs
/store-admin/subscription   # own plan summary only, if enabled
```

Preserve established AXORA branding, shared design tokens, responsive layouts and accessible controls. Reference dashboard images are visual inspiration only; they do not override the data model or justify copying unrelated branding or fabricated metrics.

## 20. Implementation Order and Delivery Evidence

Implement all eight requested modules through these dependency-aware phases:

1. Inspect the current repository and live Supabase schema; document existing/partial/missing features and credential/configuration prerequisites.
2. Harden authentication, membership resolution, RLS and scoped Sheets access; safely move platform metadata from local adapters to Supabase where needed.
3. Complete Admin Management and separate Super Admin / Store Admin dashboards without duplicating working features.
4. Add accurate advanced analytics, date filters and cache/partial-result indicators.
5. Introduce durable jobs and system monitoring, then in-app notifications with per-recipient visibility.
6. Add private backup storage, scheduled/manual backups and verified, confirmed recovery.
7. Implement subscription plans, manual assignment, history and tested server-side entitlements; leave payment integration for a later phase.
8. Verify domain routing, failure recovery, accessibility, tenant isolation and production configuration.

For each phase, provide changed files, migration/backfill/rollback steps, environment variable names (never values), commands, test results and remaining external setup.

Required tests include cross-tenant URL/payload/resource-ID attacks, disabled sessions, restricted audit/notification visibility, RLS direct API access, Sheets timeout/quota failures, duplicate writes/events, real scheduler execution, backup corruption, wrong-store restore, pre-restore backup failure, partial restore recovery, plan downgrade/expiry and unchanged storefront behavior.

Keep demo/local adapters explicitly labelled and isolated from production. Do not use fake data, fake connection health, fake backup success or fake payment status to satisfy acceptance criteria.

Final outcome: AXORA is a multi-tenant SaaS platform where Supabase manages platform identity/configuration/operations, each store's Google Sheets remains its business-data source of truth, Store Admins access only their store, and the Super Admin controls the platform centrally.
