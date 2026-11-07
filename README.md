# AXORA Admin

Multi-tenant e-commerce administration platform for **AXORA** (`admin.axora.mn`).
One Super Admin account manages every store — products, categories, orders,
customers, inventory, custom domains, settings and public storefronts — from a
single Mongolian-language dashboard.

Built with Next.js 15 App Router, TypeScript, Tailwind CSS and Supabase
(Auth + Postgres + Storage). No other UI framework is used; the design system in
`src/components/ui` is custom.

---

## 1. Feature overview

### Admin panel (`/admin`)

| Area | Capability |
| --- | --- |
| Dashboard | Platform totals, revenue/order charts, per-store context, recent activity |
| Stores | Create, edit, suspend/activate, archive, delete; store detail and settings |
| Products | CRUD, image upload, categories, variants, sale price, featured/new flags, bulk actions |
| Categories | Create/edit/delete, ordering, product counts |
| Orders | Filter/search, status + payment updates, timeline, stock restoration on cancellation |
| Customers | Aggregated from orders, searchable, per-store filtering |
| Inventory | Stock levels, low/out filters, manual adjustments with audit log |
| Analytics | Revenue, orders, AOV, top products, date ranges, per-store |
| Domains | Add domains, real DNS CNAME/A verification, TLS reachability check, primary domain |
| Audit log | Every admin mutation with actor, store, resource and metadata |
| Settings | Profile, password, notification preferences, demo reset, environment status |

### Public storefront (`/store/[slug]` and custom domains)

- Themed home page, product catalogue with search/filter/sort, product detail
- Persistent cart (`localStorage`) and server-validated checkout
- Offline payment methods only: cash on delivery / bank transfer — **no fake
  online payment success**
- Atomic stock decrement and inventory log through a database RPC
- Explicit unpaid order status and payment instructions on the success page

---

## 2. Quick start — demo mode (no backend required)

```bash
cd admin_dashboard
npm install
npm run dev
```

Open <http://localhost:3000>.

- Login: <http://localhost:3000/admin/login>
- Demo credentials: **admin@axora.mn** / **AxoraDemo!2026**
  (override with `DEMO_ADMIN_EMAIL` / `DEMO_ADMIN_PASSWORD`)
- Storefront examples: `/store/nomad-fashion`, `/store/tech-store`

Demo mode activates automatically when Supabase environment variables are
missing. Every screen shows a **DEMO ГОРИМ** banner and all data lives in server
memory — it is never presented as production data. Restarting the dev server
resets demo data; the settings page also has an explicit reset action.

Force demo mode with `AXORA_DEMO_MODE=force`, or disable it with `off`.

---

## 3. Production setup with Supabase

### 3.1 Create the project

1. Create a project at <https://supabase.com>.
2. Copy **Project URL**, **anon key** and **service_role key** from
   *Project Settings → API*.
3. Copy `.env.example` to `.env.local` and fill in the values.

```bash
cp .env.example .env.local
```

Required variables:

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public anon key (browser + RLS reads) |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only privileged key — **never expose to the browser** |
| `ADMIN_HOST` | Canonical admin hostname, e.g. `admin.axora.mn` |
| `PLATFORM_BASE_DOMAIN` | Base domain for `slug.axora.mn` storefronts |
| `AUTH_SECRET` | 32+ char secret for demo session signing |
| `INITIAL_ADMIN_EMAIL` | First Super Admin email |
| `INITIAL_ADMIN_PASSWORD` | First Super Admin password (remove after setup) |
| `AXORA_DEMO_MODE` | `auto` (default), `force`, or `off` |

Generate a secret:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 3.2 Run migrations

Run the SQL files **in order** using the Supabase CLI or SQL editor:

```text
supabase/migrations/0001_schema.sql      # enums, tables, indexes, constraints
supabase/migrations/0002_functions.sql   # triggers, authorization helpers, RPCs
supabase/migrations/0003_rls.sql         # RLS policies, grants
supabase/migrations/0004_storage.sql     # store-assets bucket + storage policies
```

With the CLI:

```bash
supabase link --project-ref <your-project-ref>
supabase db push
```

The migrations are idempotent where practical (`drop policy if exists`,
`create or replace function`, `on conflict` for the bucket).

### 3.3 Create the first Super Admin

```bash
npm run setup:admin
```

The script reads `INITIAL_ADMIN_EMAIL` / `INITIAL_ADMIN_PASSWORD`, creates (or
updates) the Supabase Auth user, confirms the email and promotes the profile to
`role = 'super_admin'`, `is_super_admin = true`. It never prints the password.

After the first login, remove `INITIAL_ADMIN_PASSWORD` from `.env.local`.

### 3.4 Storage

`0004_storage.sql` creates the public `store-assets` bucket (5 MB limit,
JPEG/PNG/WebP/AVIF). Product images are uploaded to
`<store_id>/<uuid>.<ext>`; storage policies scope writes to the matching store
folder, while reads are public because the URLs appear on storefronts.

---

## 4. Domain and storefront routing

`src/middleware.ts` resolves the request host:

1. `admin.axora.mn` / `axora.mn` → admin app.
2. `<slug>.axora.mn` → `/store/<slug>`.
3. Any other host → lookup in `store_domains` (service role) → rewrite to
   `/store/<store-slug>`.
4. Localhost always serves the admin app plus explicit `/store/[slug]` URLs.

For a custom domain:

1. Add the domain in **Admin → Domains** (or the store's domain card).
2. Point DNS at the platform:
   - `CNAME` → `cname.axora.mn`, or
   - `A` → your hosting provider's IP.
3. Click **Verify** in the admin. The check performs a real DNS lookup and a
   TLS/HTTPS reachability probe, then stores `verified` / `failed` status.
4. Set it as primary if needed. SSL is issued by the hosting provider
   (e.g. Vercel) once DNS resolves correctly.

The app does **not** claim a certificate is active until the probe succeeds.

---

## 5. Security model

- **Authentication**: Supabase Auth email/password in production; signed
  HMAC session cookie in demo mode. Sessions are HTTP-only, `SameSite=Lax`.
- **Authorization**: every admin page and every mutating Server Action calls
  `requireSuperAdmin()`. Store IDs from the client are never trusted alone.
- **Tenant isolation**: `store_id` on every tenant table plus RLS policies.
  Store owners/staff are modelled in `store_members` with `has_store_access` /
  `can_manage_store` helpers for the future.
- **RLS**: public storefront reads are limited to active stores, public
  settings, public categories and active products. Orders/order items/audit logs
  are never readable anonymously.
- **Atomic checkout**: `create_store_order()` is `SECURITY DEFINER`, validates
  visibility, locks product rows, recomputes prices/shipping server-side,
  decrements stock and writes inventory logs in one transaction.
- **Uploads**: MIME type, extension and size validated server-side; storage
  policies restrict writes to the store folder.
- **Rate limiting**: login and checkout are limited in memory. For multi-instance
  production deployment, replace `src/lib/rate-limit.ts` with a shared store
  (Upstash Redis, database, or edge middleware).
- **Audit trail**: all admin mutations write to `audit_logs` with actor,
  resource and metadata; no passwords or secrets are logged.
- **Headers**: `nosniff`, `X-Frame-Options`, `Referrer-Policy` and a restrictive
  `Permissions-Policy` are set in `next.config.ts`.

---

## 6. Project structure

```text
src/
  app/
    admin/
      (auth)/login/            Login page
      (panel)/                 Guarded admin shell + all admin pages
      actions/                 Server Actions (auth, stores, products, ...)
    store/
      [slug]/                  Public storefront (home, products, cart, checkout)
      actions/checkout.ts      Public checkout Server Action
  components/
    admin/                     Admin-specific UI
    storefront/                Storefront UI + cart context
    ui/                        Custom design system primitives
  lib/
    auth/                      Session, guards, demo credentials
    data/                      Repository contract + demo & Supabase implementations
    supabase/                  Server/service/browser clients
    ...                        types, validation, formatting, labels, theme
supabase/migrations/           0001 → 0004 SQL
scripts/setup-admin.mjs        Initial Super Admin bootstrap
```

### Data layer

`src/lib/data/repository.ts` defines the contract. Two implementations exist:

- `demo-repository.ts` — in-memory seeded dataset, used in demo mode.
- `supabase-repository.ts` — production implementation using the anon client for
  RLS-scoped reads/writes and the service role only where explicitly required
  (host resolution, post-checkout fetch).

Keep both implementations in sync when changing the contract.

---

## 7. Scripts

```bash
npm run dev         # Next dev server
npm run build       # Production build
npm run start       # Start production build
npm run typecheck   # TypeScript, no emit
npm run setup:admin # Create/promote the initial Supabase Super Admin
```

---

## 8. Verification checklist

Demo mode:

1. `npm run typecheck && npm run build`
2. `npm run dev`, sign in with the demo credentials.
3. Dashboard shows seeded stores, orders, charts and activity.
4. Open a store → edit → settings; changes are reflected in admin and storefront.
5. Create a product, adjust stock, change an order status.
6. Open `/store/nomad-fashion`, add a product to the cart, checkout with cash on
   delivery, confirm the success page shows **Төлөгдөөгүй** and payment
   instructions.
7. The new order appears in **Admin → Orders** with status **Шинэ**.
8. Open **Settings → Demo reset** to restore the seed.

Supabase mode:

1. Run all four migrations.
2. Run `npm run setup:admin`.
3. Sign in with the initial admin account.
4. Verify anon users cannot read `orders` or `audit_logs` via the REST API.
5. Verify a storefront checkout creates an order and decrements stock.
6. Add a custom domain, point DNS, run **Verify**, and confirm the probe result.

---

## 9. Known limitations / next steps

- Live Supabase behavior could not be executed in this environment (no project
  credentials). The SQL and repository mappings are written against the schema
  in `supabase/migrations`; run the verification checklist before launch.
- Demo data is intentionally in-memory and resets on server restart.
- Rate limiting is per-process; use a shared store for horizontal scaling.
- Online card payments are deliberately not integrated. Orders are unpaid until
  a real transaction is confirmed; do not mark them paid automatically.
- Store Owner / Staff roles are modelled in the schema and RLS but the admin UI
  currently exposes the Super Admin experience only.
- Email notifications are represented as preferences; transactional email
  delivery requires an email provider integration.
- Storefront product images use generated gradient placeholders until real
  images are uploaded.

---

## 10. License

Private / proprietary — AXORA Platform.
