# Customer dashboard QA report

Date: 2026-11-10. Repository: Axora3/admin_dashboard. **Status: locally verified; live integrations unverified; not production-ready.**

## Executed checks

| Check | Result | Evidence / limits |
|---|---|---|
| TypeScript | Passed | `npm run typecheck`; includes application and browser-test TypeScript |
| Customer lint | Passed, zero warnings | `npm run lint`; scoped to customer/auth-membership code and customer/admin data APIs, not the entire repository |
| Production build | Passed | `npm run build`; Next.js 15.5.29; existing whole-repository unused-variable and image warnings remain |
| Customer adapter/security suite | 11 passed | `npm run test:customer`; actual typed adapter + customer service + file-backed Sheets backend; identity/registry/locks/audit/revalidation are controlled test doubles |
| Browser suite | 7 passed | `npm run test:customer:e2e`; production-built Next.js, installed Chrome, actual route handlers and forms; synthetic Supabase identity/membership and AXORA billing HTTP services; local file-backed Sheets |
| Existing security suite | 7 passed | `npm run test:security` |
| Existing Sheets suite | 6 passed | `npm run test:sheets`; transport/static policy coverage; not live Google |
| Platform suite | 19 passed | `npm run test:platform`; corrected UUID fixtures so notification scoping assertions actually execute |
| Delivery regressions | 11 passed | `npm run test:delivery`; existing delivery behavior preserved |
| Browser bundle secret scan | Passed | 80 production and 80 QA browser JS files scanned; zero matches for configured server-only credentials or fixture service/billing tokens; this does not replace a full secret audit |
| Dependency audit | 0 vulnerabilities returned | `npm audit --json`; initial sandbox network attempt failed, retried successfully with network permission |

Browser tests create, read, edit and delete a product, menu item, service, page and portfolio project independently. They assert the published public API returns the edited stable record, reject a foreign site's query, check every enabled customer navigation route returns 200, and check no horizontal document overflow at 375, 768 and 1440 pixels. These are automated viewport/overflow checks, not a manual screenshot or device usability review. They test actual site-switch behavior, stale selected-site requests, displayed plan prices, viewer write denial and anonymous API denial. HTML is checked for fixture-only server service/billing credentials. There is no production authentication bypass or test login route: the normal Supabase SDK calls a synthetic loopback Auth service.

The adapter suite also exercises categories, customers, discounts, orders, reservations, opening hours, staff, appointments, availability, gallery, articles, contact inquiries, project categories and inventory journal row CRUD. These are data CRUD tests, not proof of checkout redemption, fulfillment, booking capacity enforcement or inventory transaction reconciliation. Schema preparation tests preserve unknown cells and stable IDs. Module-configuration settings have route smoke coverage; their complete save workflow is not covered by the browser suite. False optional/default booleans are not reset by partial updates. Header casing mismatches fail explicitly.

A→B rejection is verified with separate site records/workbooks, server permission guards and browser/API tests. Viewer writes, anonymous requests, forged selected-site IDs, cross-origin mutations, disabled modules, foreign relationship IDs, insecure media URLs, fake manual payment-state writes, stale updates and unconfirmed deletions are rejected in the covered tests. Real database RLS is a separate unexecuted gate.

## Fixed during testing

- Optional blank URL fields blocked portfolio updates; normalization now supports clearing optional fields.
- SEO JSON fields incorrectly initialized as arrays; object/array defaults now follow the resource schema.
- Zod v4 default insertion could reset omitted boolean fields; updates retain only explicitly submitted keys.
- Rapid updates could retain identical version timestamps; update versions now advance monotonically.
- Header matching could accept casing variations but then read empty cells; validation now requires exact configured spelling.
- A notification test used non-UUID users and never reached its scoped database read; fixtures now use valid UUIDs.

The initial browser run exposed profile/portfolio errors and an ambiguous test header locator. Those failures were corrected and the complete strengthened suite rerun successfully. Initial sandbox browser-server teardown needed verified QA process cleanup; the successful suite ran with permission to stop its own server processes. No production process or deployment was used.

## Checks not performed / unresolved gates

| Severity | Repository / file or route | Problem / evidence | Required correction / dependency |
|---|---|---|---|
| High | admin_dashboard / Google backend | Google credentials are absent in the inspected environment; no actual Google CRUD or quota test was attempted | Configure disposable staging spreadsheets/service account; run CRUD and failure tests for all five business types |
| High | admin_dashboard / migration 0008 and Supabase RLS | Supabase environment values exist, but no staging project was identified and live migration/tenant database verification was not performed | Apply additive migration on staging; test users A/B/viewer/revoked and direct authenticated REST access |
| High | Independent customer websites / public site-data API | Published API projection verified locally; actual independently deployed websites were not exercised | Configure verified staging domains and website adapters; verify end-to-end write propagation and maximum cache age |
| High | admin_dashboard / customer/billing.ts | Real AXORA billing source is unconfigured; response contract tested with fixtures only | AXORA implements authoritative scoped API; configure server token and verify delivery/trial/payment cases |
| Medium | admin_dashboard / rate-limit.ts | Rate limits are in process memory | Shared atomic limiter before multi-instance production rollout |
| Medium | admin_dashboard / site-data-service.ts and customer/data.ts | Google direct edits and uncertain partial writes have no database transaction/CAS guarantee; cache invalidation is local | Staging fault/concurrency tests and reconciliation; shared invalidation or per-website hooks as needed |
| Medium | admin_dashboard / inventory, discounts, availability | CRUD exists; stock-journal reconciliation, checkout discount redemption and appointment conflict/capacity enforcement are incomplete | Implement business workflows with corresponding website/payment dependencies; do not advertise as completed |
| Low | admin_dashboard / legacy components and data repository | Full build emits existing unused-variable/image lint warnings | Separate cleanup; targeted customer lint is clean |

The environment was inspected only for presence flags; no secret values were logged. The service-role and billing-token fixture values are synthetic. The migration, real Google credentials, real payment history, real confirmed website delivery and actual deployed customer-site behavior are **not verified**.

## Reproduction

Run `npm run typecheck`, `npm run lint`, `npm run test:customer`, the four existing suites, and `npm run build`. For browser tests run `npm run test:customer:e2e` with Chrome installed and loopback ports 43219/43220 free. It creates isolated synthetic workbooks at `.data/customer-browser-qa`, builds to `.next-qa`, and never uses the production registry or Google API. Unit tests create a unique temporary emulator directory and leave it for inspection. Do not point fixture scripts at real customer data.

Prioritized rollout and remaining implementation are in `CUSTOMER_DASHBOARD_IMPLEMENTATION.md`. No production-ready claim should be made until the live gates above pass.
