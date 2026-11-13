# Repository Status

**Snapshot date:** 2026-11-09. Paths below refer to the inner project roots in this checkout; the surrounding folder names are wrapper folders.

## Summary matrix

| Repository | Framework / versions (declared) | Structure and routes | Data/auth | Current state and checks |
|---|---|---|---|---|
| Axora | Next.js 16.4.3, React 19.3.0, TypeScript 5, Tailwind 4, Supabase | App Router under `src/app`: storefront/catalog, template/bundle/blog/learn/portfolio/services, builder/order/contact, APIs and admin actions | Supabase Auth/Postgres/Storage; no customer Sheets client found | Typecheck pass; lint pass with 3 warnings; build blocked by restricted Google Fonts fetch. Existing `.env.local` is ignored/untracked; values were not read. |
| admin_dashboard | Next.js 15.5.29, React 19.0.0, TypeScript 5.7, Tailwind 3, Supabase | App Router under `src/app`: Super Admin, Store Admin, `/store/[slug]` storefront, checkout/cart, notifications/reports/jobs APIs | Supabase for platform/auth/registry; per-store Google Sheets for business data; local JSON emulator when unconfigured | Typecheck/build pass; security 7/7 and delivery 11/11 pass; SaaS tests 7/8 (one invalid test fixture); lint command prompts interactively. Working tree already had multiple modified/untracked files. |
| online_store_template | Vanilla HTML/CSS/JS + Google Apps Script | Single-page ORVANTE storefront/admin experience; Apps Script `doGet`/`doPost` RPC | Apps Script runs as owner; one fixed spreadsheet ID; email OTP and server-side store tables | Mock service tests pass 15/15. Actual Apps Script authorization, deployment, email, and workbook were not verified. No package manifest; build script edits HTML. |
| online_store_template_2 | Next.js 14.2.15, React 18.3.1, TypeScript 5.6.3, Tailwind 3 | App Router pages: home, products/categories/sale, about/contact, checkout/terms/privacy, `/api/orders` | Product catalog in `lib/products.ts`; optional `ORDER_WEBHOOK_URL`; no Google Sheets or auth adapter | TypeScript pass; build blocked by Google Fonts network fetch. No lint/test script. Product and order persistence are demo/incomplete without webhook. |
| coffe_shope_template | Single HTML document; inline CSS/JS and remote modules/assets | MORI COFFEE landing/menu/cart experience in `index.html` | No Sheets, API, database, or auth integration found | No package/test/build manifest; no automated check available. Cart is browser-local; checkout and contact show success without transmitting data. |
| business_profile_template | Vite 8.3.6, React 19.3.1, TypeScript 7.0.2, Tailwind 4 | One-page architecture/engineering profile; sections in `src/App.tsx` and components | Static content in `src/data/company.ts`; `src/components/Contact.tsx` has an empty source constant for endpoint, otherwise mailto | Typecheck and Vite build pass. Sample content and non-automatic mailto fallback remain. |

## Folder and design notes

- **Axora:** substantial component library under `src/components`, reusable UI primitives, Supabase helpers and migrations. Design documentation and visual QA artifacts exist. The builder has demo configuration/data; treat end-to-end website publishing as unverified.
- **admin_dashboard:** server actions and route handlers under `src/app`, domain libraries for Google Sheets, auth, registry, platform controls, backups, delivery, and reporting. `src/components` includes admin, storefront, delivery, and shared UI. Local file persistence is under `.data` and ignored.
- **online_store_template:** HTML storefront plus generated `scripts/live-client.js` embedded by `scripts/build.mjs`; Google Apps Script lives under `apps-script`. `README.md` states deployment and real workbook setup remain owner steps.
- **online_store_template_2:** clear page/component split, but legacy `assets/js` and CSS sit beside the React implementation. Current checkout webhook is an integration seam, not an order system.
- **coffe_shope_template:** one large HTML file with inline presentation/interaction and remote Three.js import map. Maintainability and testability are low; no API boundary is present.
- **business_profile_template:** organized content data, page sections, motion hooks, and UI components. The page is static and content-driven.

## Authentication, API, and CRUD status

- **Axora:** Supabase browser/server clients and `src/proxy.ts`; API routes include orders, attachments, contact, and template requests. Admin actions cover templates/projects/payments/notifications. SQL migrations and RLS exist. Typecheck/lint are verified; live auth, payment, storage, and DB behavior are not.
- **admin_dashboard:** supports local/supabase auth modes, role checks, server actions for stores/products/categories/orders/inventory/settings/domains/delivery/admins, and store-scoped registry/data access. Google Sheets CRUD exists in code; only isolated contract tests were run. No actual spreadsheet mutation was performed.
- **online_store_template:** server code implements email one-time-code auth, profiles, user order history/cancel, admin products/order statuses, and inventory checks under script locks. Fifteen mock tests pass; external service behavior remains unverified.
- **online_store_template_2:** product browse/cart UI is functional against static data. Checkout posts to an optional webhook; without one it returns an explicit demo/non-persisted response. No user/admin auth or CRUD.
- **coffe_shope_template:** no backend CRUD/auth routes found.
- **business_profile_template:** no auth or persistent CRUD; content is edited in source. Contact endpoint is optional.

## Environment and deployment

- Axora and admin_dashboard each have `.env.example`, ignored `.env.local`, and Next configs. Local env file values were not read. Admin dashboard local env variable names contain no Google service-account variables; the code defaults to its local Sheets emulator.
- `online_store_template` configures `ADMIN_EMAIL`, `AUTH_SECRET`, `READY`, contact/payment properties in Apps Script Script Properties. Its spreadsheet ID is currently fixed in source. Deployment steps explicitly require owner authorization and a Web App deployment.
- `online_store_template_2` has no `.env.example`; optional server variables are `ORDER_WEBHOOK_URL` and `ORDER_WEBHOOK_SECRET`.
- Business profile has no documented environment variable for contact delivery; `src/components/Contact.tsx` currently has an empty source constant, with a mailto fallback.
- No project deployment config was identified for the coffee template. No shared hosting/factory manifest exists. No deployment was performed.

## QA limits

No real Google workbook, service account, Supabase project, auth session, payment processor, or generated-site deployment was used. Responsive source styles exist in the designed projects, but no viewport-by-viewport visual browser audit was run. See [ECOSYSTEM_AUDIT.md](ECOSYSTEM_AUDIT.md) for exact findings and command results.
