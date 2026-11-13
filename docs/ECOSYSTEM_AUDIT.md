# AXORA Ecosystem Audit

**Audit date:** 2026-11-09  
**Scope:** current working trees for Axora, admin_dashboard, online_store_template, online_store_template_2, coffe_shope_template, business_profile_template.  
**Audit type:** read-only code/configuration review plus checks listed below. No production deployments, live Sheets mutations, or schema changes were made.

## Executive summary

The repositories are separate applications, as intended, but they do not yet form a verified end-to-end website factory. Axora is a Next.js platform backed by Supabase. `admin_dashboard` is a separate multi-store app with a substantial Google Sheets adapter and a file-backed local emulator. One store starter (`online_store_template`) has its own Apps Script/Sheets backend. `online_store_template_2` uses local mock products and an optional order webhook. The coffee and business profile starters are standalone static experiences without a Sheets backend. The future factory repository does not exist in this checkout.

The strongest verified areas are the dashboard’s typecheck/build, its server-side store scoping and delivery test suites, the Apps Script mock tests, and the business profile build. No real Google service account or spreadsheet was exercised. The dashboard `.env.local` has no Google credential variable names, and its source explicitly falls back to local file storage when credentials are absent. A successful local/mock check therefore does not establish that a customer spreadsheet is connected.

## Verified findings

Severity uses **Critical / High / Medium / Low**. “Evidence” describes code or checks observed in this audit; it does not imply a live production system was exercised.

### AX-01 — Dashboard can fall back to known local administrator credentials

- **Repository:** admin_dashboard
- **File or route:** `src/lib/config.ts` (`LOCAL_ADMIN_EMAIL`, `LOCAL_ADMIN_PASSWORD`, `isLocalAuthMode`, `authSecret`); `src/lib/auth/session.ts`
- **Problem:** Local auth is selected automatically when Supabase is not configured. The config supplies a known demo password and development signing secret when corresponding environment values are absent. A production deployment missing Supabase/auth configuration can therefore enter a local-auth path with predictable defaults.
- **Severity:** High
- **Evidence:** The defaults are literal source values; `AXORA_AUTH_MODE=auto` selects local auth when Supabase is not configured. No production runtime was accessed.
- **Recommended correction:** Fail closed in production: require explicit local mode only for development, require strong `AUTH_SECRET` and non-demo admin credentials, and make startup fail if production auth configuration is incomplete.
- **Dependencies:** Deployment environment configuration and auth-mode contract.

### AX-02 — Sheets mode is not live-verified in the current dashboard environment

- **Repository:** admin_dashboard
- **File or route:** `src/lib/config.ts`; `src/lib/google/sheets-client.ts`; `src/lib/data/google-repository.ts`; `src/app/admin/actions/sheets.ts`
- **Problem:** The code supports per-store Google Sheets, but the current local environment has no Google service-account variable names, so the configured behavior is the local emulator unless credentials are injected elsewhere. No real store/spreadsheet connection, CRUD, quota behavior, or public-site refresh was exercised.
- **Severity:** High
- **Evidence:** `.env.local` variable names were inspected without reading values; no `GOOGLE_SERVICE_ACCOUNT_*`, `GOOGLE_PRIVATE_KEY`, or `GOOGLE_PRIVATE_KEY_ID` entries are present there. `sheetsMode()` defaults to local when credentials are absent. A prior in-repository status note also describes local emulator mode; it is not treated as live verification.
- **Recommended correction:** Before production acceptance, provision a disposable staging spreadsheet and service account, verify connection inspection and each CRUD path, then verify the same changed row is visible on the storefront after the cache window/revalidation. Keep this as a staging checklist.
- **Dependencies:** Google Cloud Sheets API enabled, service account, isolated staging spreadsheets, deployed environment secrets.

### AX-03 — Dashboard SaaS notification unit test does not exercise its asserted scope

- **Repository:** admin_dashboard
- **File or route:** `scripts/test-saas-expansion.cjs` notification test; `src/lib/platform/notifications.ts` (`isAuthUserId`, `notificationPage`)
- **Problem:** The test uses admin id `u`, which is not a UUID. `notificationPage()` returns before issuing the scoped query, so the assertion that a `store_id` filter was applied fails. This is a test-fixture defect; the test does not demonstrate a tenant-isolation defect.
- **Severity:** Medium
- **Evidence:** Current run: 7/8 SaaS tests pass; the failing assertion expects the `store_id` query. Production function returns early for a non-UUID auth-user id. The separate admin-security tests pass 7/7 and explicitly verify store scoping.
- **Recommended correction:** Use a valid UUID in the fixture and assert the intended scoped query and visibility result. Keep the valid-ID guard.
- **Dependencies:** SaaS unit test fixture.

### AX-04 — Dashboard lint command is interactive and does not run lint

- **Repository:** admin_dashboard
- **File or route:** `package.json` (`lint` script)
- **Problem:** `npm run lint` invokes `next lint`, which presents an interactive ESLint setup prompt in the installed Next.js version. A noninteractive audit/CI run exits without lint findings.
- **Severity:** Low
- **Evidence:** Direct command opened the “Strict / Base / Cancel” configuration prompt and exited with code 1. The production build itself completed.
- **Recommended correction:** Add an explicit ESLint config and make the lint script call the ESLint CLI with a fixed target; make CI run it noninteractively.
- **Dependencies:** ESLint configuration and CI script.

### AX-05 — Optional order webhook receives client-submitted totals and line prices

- **Repository:** online_store_template_2
- **File or route:** `app/api/orders/route.ts`; `components/CheckoutForm.tsx`; `lib/products.ts`
- **Problem:** The route checks that customer fields and a nonempty items array exist, then forwards the client payload—including totals, prices, quantities, and item names—to `ORDER_WEBHOOK_URL`. It does not validate quantities/prices against an authoritative backend catalog, recalculate totals, enforce a request schema/size limit, or rate-limit the endpoint. Without a webhook, it truthfully returns a demo result and does not persist an order.
- **Severity:** High
- **Evidence:** Route implementation forwards `payload` as received; products are a source-code array. UI labels QPay/bank as requiring a backend. No order webhook was configured or called in this audit.
- **Recommended correction:** Treat the UI payload as item identifiers and requested quantities only; validate against an authoritative catalog, calculate totals server-side, apply rate limits and idempotency, and return a clear demo/non-persisted outcome until persistence is connected.
- **Dependencies:** Backend contract, catalog source, payment provider and order persistence decisions.

### AX-06 — Store starter projects have incompatible data contracts and no adapter contract

- **Repository:** online_store_template; online_store_template_2; coffe_shope_template; business_profile_template; admin_dashboard
- **File or route:** `online_store_template/apps-script/Code.gs`; `online_store_template_2/app/api/orders/route.ts`; other templates’ source trees
- **Problem:** The dashboard’s six-tab spreadsheet contract, the ORVANTE Apps Script workbook, the webhook-only template, and static templates are independent and incompatible. No versioned integration contract or provisioning path links a generated customer project to the dashboard’s per-store configuration.
- **Severity:** High
- **Evidence:** Dashboard maps Products/Categories/Orders/Customers/Settings/InventoryLogs. ORVANTE initializes Products/Users/Orders/Sessions/LoginCodes with its own columns. Template 2 has no Sheets client. Coffee and business profile have no server/API project structure.
- **Recommended correction:** Define the factory’s versioned project manifest and integration contract before generation work; specify which templates use dashboard storefront APIs, direct Sheets access, or no commerce backend. Preserve separate deployments and repositories.
- **Dependencies:** axora-website-factory design, tenant/provisioning model, supported template capabilities.

### AX-07 — ORVANTE spreadsheet identifier is embedded in Apps Script source

- **Repository:** online_store_template
- **File or route:** `apps-script/Code.gs` (`SHEET_ID_`)
- **Problem:** One spreadsheet ID is hard-coded into the Apps Script project. It binds the starter to one workbook and makes cloning/provisioning error-prone. The value is intentionally omitted from this audit report.
- **Severity:** Medium
- **Evidence:** `Code.gs` line 3 declares a fixed `SHEET_ID_`; `initializeStore()` provisions tabs in that workbook. This is an identifier, not an API credential; no secret value is reproduced here.
- **Recommended correction:** Store the workbook ID in Script Properties and require an owner-only configuration step. Add a preflight that verifies ownership/access and expected tabs before enabling `READY`.
- **Dependencies:** Apps Script deployment/provisioning instructions.

### AX-08 — Online store template 2 production build depends on network fonts

- **Repository:** online_store_template_2
- **File or route:** `app/layout.tsx`
- **Problem:** The build fetches Inter from Google Fonts and fails when external network access is unavailable. This makes the production build dependent on build-time access to Google Fonts.
- **Severity:** Medium
- **Evidence:** Build in an isolated temporary copy failed at `next/font` with `EACCES` while fetching `Inter`; TypeScript check passed. No repository files were changed by that temporary build.
- **Recommended correction:** Bundle the font locally or use a system stack so builds do not require a network fetch.
- **Dependencies:** Font licensing/asset choice and build pipeline.

### AX-09 — Axora production build also requires network font access

- **Repository:** Axora
- **File or route:** `src/app/layout.tsx`
- **Problem:** The optimized build attempts to fetch several Google Fonts. The audit environment cannot reach the font service, so a clean production build cannot be confirmed here.
- **Severity:** Medium
- **Evidence:** `next build --webpack` in an isolated copy failed for Cormorant Garamond, Lora, Manrope, Onest, and Rubik fetches with `EACCES`. `tsc --noEmit` and ESLint completed; ESLint reported three warnings and zero errors.
- **Recommended correction:** Bundle font files locally or provide a documented build-time network requirement and test it in CI. Prefer local assets for reproducible deployment builds.
- **Dependencies:** Font asset licensing, layout font declarations, CI network policy.

### AX-10 — Business profile content is demonstrative and its contact form is not a guaranteed delivery service

- **Repository:** business_profile_template
- **File or route:** `src/data/company.ts`; `src/components/Contact.tsx`
- **Problem:** Company identity, project portfolio, and contact details are explicitly sample content. `src/components/Contact.tsx` has an empty `CONTACT_ENDPOINT` source constant, so the form opens a prefilled `mailto:` draft; it does not submit or store a request automatically.
- **Severity:** Medium
- **Evidence:** Source labels values as illustrative; contact form uses `CONTACT_ENDPOINT` only when configured and otherwise navigates to `mailto:`. Build passes, but no real contact submission was sent.
- **Recommended correction:** Make customer content replacement part of provisioning and configure/test a real endpoint where automatic delivery is required. Keep the mail-client path accurately described.
- **Dependencies:** Customer content, contact endpoint, privacy/retention policy.

### AX-11 — Current dashboard checkout uses one app’s cached spreadsheet data, not a cross-project live sync

- **Repository:** admin_dashboard
- **File or route:** `src/lib/data/google-repository.ts` (`CACHE_TTL_MS`/cache invalidation); admin server actions; `src/app/store/[slug]`
- **Problem:** Dashboard mutations invalidate the dashboard repository cache and revalidate its Next.js paths, so this application is designed to reflect changes on its own storefront. There is no evidence that these invalidations notify independently deployed customer projects.
- **Severity:** Medium
- **Evidence:** 20-second in-process table cache and mutation invalidation are present; admin actions revalidate storefront/layout paths. The factory and deployed customer projects are absent from this checkout, and no live browser or Sheets propagation test was run.
- **Recommended correction:** Define and test an explicit cross-project refresh mechanism (webhook/revalidation token, bounded polling, or other chosen contract) for generated independent sites. Document the consistency window.
- **Dependencies:** Independent deployment model and factory integration contract.

### AX-12 — Coffee checkout and contact handlers report success without sending data

- **Repository:** coffe_shope_template
- **File or route:** `index.html` checkout and `#contactForm` handlers
- **Problem:** Checkout clears a browser-local cart and shows an order-received toast; contact resets the form and shows a sent toast. Neither action calls a server or persists the request.
- **Severity:** Medium
- **Evidence:** Source handlers only update local state/DOM; no API, fetch, Sheets, or database code was found. Runtime behavior was not browser-tested.
- **Recommended correction:** Connect a real endpoint and show success only after confirmation, or label these controls as demo interactions and do not imply submission.
- **Dependencies:** Cafe ordering/contact workflow and backend choice.

### AX-13 — Dashboard numeric parsing assumes commas are grouping separators

- **Repository:** admin_dashboard
- **File or route:** `src/lib/google/mapping.ts` (`toNumber`)
- **Problem:** Numeric parsing removes commas before conversion. A locale-formatted decimal such as `1,5` becomes `15`, so manually entered values using comma decimals can be misinterpreted.
- **Severity:** Medium
- **Evidence:** `toNumber()` strips non-digit/dot/comma characters, then removes every comma. Google API unformatted numeric cells avoid this in common cases; imported/manual text remains a risk.
- **Recommended correction:** Define the accepted numeric format for Sheets columns, reject ambiguous text, and test supported locale examples instead of silently coercing.
- **Dependencies:** Spreadsheet data-format contract and locale policy.

## Checks performed

| Repository/check | Result | Scope and limitation |
|---|---|---|
| Axora `npm run typecheck` | Pass | `tsc --noEmit` |
| Axora `npm run lint` | Pass with 3 warnings | Zero errors; warnings are in `regen-icons/generator/.dev` scripts |
| Axora production build | Not confirmed | Temporary build failed fetching Google Fonts in restricted network |
| admin_dashboard `npm run typecheck` | Pass | `tsc --noEmit` |
| admin_dashboard `npm run lint` | Not run to completion | Deprecated `next lint` opens interactive setup prompt |
| admin_dashboard production build | Pass | Built current working-tree copy in a temporary directory; no production services were called intentionally |
| dashboard admin-security tests | Pass, 7/7 | Isolated tests |
| dashboard delivery tests | Pass, 11/11 | Mocked/local contracts; no live Sheets/Supabase writes |
| dashboard SaaS expansion tests | Fail, 7/8 | One notification test fixture uses non-UUID ID; see AX-03 |
| online_store_template Apps Script tests | Pass, 15/15 | `node --test tests/server.test.mjs`; service mocks only |
| online_store_template build/deployment | Not run | Build script rewrites and synchronizes HTML; real GAS authorization/deployment requires owner action |
| online_store_template_2 TypeScript | Pass | `tsc --noEmit` |
| online_store_template_2 production build | Fail in this environment | `next/font` cannot fetch Google Fonts; see AX-08 |
| coffe_shope_template checks | Not available | Static single HTML file; no package/test/build manifest |
| business_profile_template TypeScript/build | Pass | `tsc --noEmit` and Vite production build in a temporary copy |
| Live Sheets/Supabase/deployment/browser responsive QA | Not performed | Requires staging credentials/services and visual browser test |

## Audit caveats

- `admin_dashboard` has an existing non-clean working tree with modified source/config files and untracked delivery-related files. This audit describes the working tree as found; it does not attribute those changes to this audit and does not compare them against a pristine baseline.
- The other five repositories were clean according to the Git status check.
- Local `.env.local` values were never printed or copied into these reports. The audit checked only key names and ignored/tracked status. Spreadsheet IDs and credentials are omitted.
- Findings about runtime behavior are marked unverified unless a test or local build directly established the behavior.
