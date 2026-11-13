# Google Sheets Integration Tests

## Test layers

| Layer | What it proves | Current status |
|---|---|---|
| Pure schema/adapter tests | Business type/resource guard, data validation, stable IDs, idempotency, optimistic conflicts, soft deletion, extension round-trip | Mock verified: `npm run test:sheets` (currently 6 cases). |
| Fake Google transport | JWT request construction, retries, quota/error mapping, provisioning retry/discovery, partial failure | Not implemented as an isolated fake transport suite. |
| Server authorization tests | Admin membership, permission, forged site IDs, origin allowlist, public projection and create-only restrictions | Existing `npm run test:security` passes dashboard auth isolation; new route policy assertions are static source checks, not route execution tests. |
| Staging Google integration | Real create/find workbook, tabs/headers, probe, CRUD, quota/error path | Not run; requires disposable Google credentials and workbook. |
| End-to-end website flow | Dashboard write -> Sheets -> public website sees new published projection; visitor intake creates correct site row | Not run; requires live staging deployment and verified domain. |

## Required cases

1. Each supported business type accepts only its registered resources; wrong type/resource fails before API calls. (Mock verified.)
2. Validate required fields, lengths, URLs, enums, amounts, dates, JSON extensions, spreadsheet IDs, tab names and headers.
3. Create with the same idempotency key twice returns one stable record; a changed request with the same key conflicts. (Mock verified.)
4. Update/delete locate by stable record ID; row shifts do not change identity. Stale `expectedUpdatedAt` conflicts. Delete requires explicit confirmation and writes tombstone.
5. Unknown extension data survives read/update; missing optional extension columns can be added without replacing existing values/formulas.
6. Dashboard member of site A cannot read/update/delete/provision site B, including forged IDs and direct action invocation.
7. Anonymous public reads reveal only published fields. Public create routes accept only their allowed resource and never return private order/customer data. No anonymous list of orders or direct row lookup.
8. Invalid/unverified Origin, missing site/domain, inactive site/module, malformed JSON, oversized payload and rate-limit excess fail closed.
9. Simulate 401/403/404/429/500, timeout, malformed response, missing tab/header, duplicate operation, concurrent update, lost provisioning response and partial initialization.
10. Dashboard mutation invalidates internal cache; external public read observes the updated Sheets revision within the documented freshness bound.
11. Scan server/client bundles and network payloads for private key, access token, spreadsheet ID, arbitrary tab access and admin data.
12. Run a real disposable-spreadsheet flow. Record timestamp, test workbook alias, site/resource, result and API request ID without storing secrets or PII.

## Honest success criteria

Only the final staging Google/API and website flow can mark the integration as live verified. Pure unit or mock test success must be reported as “mock verified” and must never be described as a successful live Google Sheets integration. Current dashboard credentials were not available, so no Google API request, provisioning run, or complete website flow was performed.

## Customer dashboard implementation update — 2026-11-10

The newer `CUSTOMER_DASHBOARD_QA.md` records 11 customer adapter/security tests and seven production-build browser tests, including all five business types. Those tests execute actual customer routes/forms against a file-backed Sheets emulator and synthetic identity/billing providers. They supersede the earlier statement that customer-route coverage is only static source inspection. Real Google, live Supabase RLS and independently deployed website flows remain unverified. See `CUSTOMER_DASHBOARD_IMPLEMENTATION.md` for rollout gates and environment requirements.
