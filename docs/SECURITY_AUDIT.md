# Security Audit

**Scope:** source/config review of the six working trees; isolated security tests. No penetration test, live environment, production browser bundle, or external service access was used. Secrets and spreadsheet IDs are omitted.

## Findings

### SEC-01 — Dashboard local-auth defaults are unsafe if production falls back

- **Repository:** admin_dashboard
- **File or route:** `src/lib/config.ts`; `src/lib/auth/session.ts`; `src/middleware.ts`
- **Problem:** Default auth selection chooses local auth when Supabase is not configured; source contains a demo password and development session secret fallback.
- **Severity:** High
- **Evidence:** Source constants and auth-mode selection are present; local test suites verify role gates, not production misconfiguration behavior.
- **Recommended correction:** In production, refuse startup unless Supabase auth is configured and demo credentials/secrets are overridden. Explicitly allow local auth only in development/test.
- **Dependencies:** Production env validation and deployment manifests.

### SEC-02 — Template 2 order API trusts client-supplied amount fields

- **Repository:** online_store_template_2
- **File or route:** `app/api/orders/route.ts`
- **Problem:** Route validates only some required fields and forwards client-controlled prices, totals, names and quantities to an optional webhook. No rate limit, idempotency, payload-size bound, or server-side price check appears in this route.
- **Severity:** High
- **Evidence:** Route serializes the request payload to webhook; authoritative products are source fixtures. No live backend was available.
- **Recommended correction:** Accept only product IDs/quantities, reload authoritative prices, calculate totals server-side, enforce bounded input, rate limits and idempotency, and authenticate webhook calls.
- **Dependencies:** Backend order schema and product catalog.

### SEC-03 — ORVANTE spreadsheet mapping is fixed in source

- **Repository:** online_store_template
- **File or route:** `apps-script/Code.gs` line 3
- **Problem:** One spreadsheet ID is embedded in Apps Script source. This leaks an identifier if the source is distributed and can bind cloned projects to the wrong workbook. It is not a credential.
- **Severity:** Medium
- **Evidence:** Fixed `SHEET_ID_` is used by Apps Script helpers and initializer. Value is redacted here.
- **Recommended correction:** Use owner-only Script Properties, verify workbook ownership and share settings, and add clone-time preflight.
- **Dependencies:** Apps Script deployment process.

### SEC-04 — Cross-project tenant sync is undefined

- **Repository:** admin_dashboard and all store templates
- **File or route:** `src/lib/auth/store-scope.ts`; `src/lib/data/index.ts`; template integration boundaries
- **Problem:** Dashboard’s store scope protects dashboard operations, but there is no verified cross-project credential handoff or refresh contract for independently deployed generated websites. Reusing dashboard credentials inside a customer project would be unsafe.
- **Severity:** High
- **Evidence:** Store Admin assignment is derived server-side; isolated security tests pass. No factory repo or generated-site authorization integration exists in this checkout.
- **Recommended correction:** Define separate project credentials and a least-privilege, server-to-server contract. Never embed service-role keys, Google private keys, or privileged spreadsheet mappings in generated client bundles.
- **Dependencies:** Factory architecture and independent deployment model.

### SEC-05 — Dashboard Google API handling is defensive but lacks live quota proof

- **Repository:** admin_dashboard
- **File or route:** `src/lib/google/sheets-client.ts`; `src/lib/platform/telemetry.ts`
- **Problem:** Client has timeouts, safe user-facing status messages, 429/5xx retry for GET/PUT, and telemetry. Full-column reads and no load/quota test mean production-scale behavior and quota recovery remain unknown.
- **Severity:** Medium
- **Evidence:** Code review and mock delivery tests; no live Google API calls.
- **Recommended correction:** Add bounded reads/pagination where workbook sizes require it, instrument per-store latency/quota errors, and test 429/timeout recovery against a staging project. Validate locale-specific numeric inputs rather than silently treating commas as grouping separators.
- **Dependencies:** Expected catalog size and Google quota plan.

### SEC-06 — Template 2 can return success-shaped demo checkout responses

- **Repository:** online_store_template_2
- **File or route:** `app/api/orders/route.ts`; checkout result UI
- **Problem:** Missing webhook returns HTTP 200 `{ok:true,demo:true,orderId:null,paymentStatus:not_processed}`. This is correctly labeled in the API message, but consumers must preserve the `demo` flag and never represent it as a completed paid order.
- **Severity:** Medium
- **Evidence:** Direct source inspection; no webhook configured or invoked.
- **Recommended correction:** Keep the flag mandatory in the typed client contract and show an unmistakable non-persisted message. Add an integration test for webhook absent and present outcomes.
- **Dependencies:** Checkout UI and webhook contract.

### SEC-07 — Customer-facing demo content/contact details require replacement

- **Repository:** business_profile_template and online_store_template_2
- **File or route:** `business_profile_template/src/data/company.ts`; `online_store_template_2/lib/products.ts`
- **Problem:** Sample company, product, stock and review data can be mistaken for a real customer’s public information if deployed unchanged.
- **Severity:** Medium
- **Evidence:** Sample company file explicitly labels demo content; template 2 catalog is a source-code fixture array.
- **Recommended correction:** Add a provisioning checklist that blocks publish while placeholder content remains; source data from an owner-approved store config.
- **Dependencies:** Website factory content manifest.

### SEC-08 — Coffee checkout/contact claim success without transmitting data

- **Repository:** coffe_shope_template
- **File or route:** `index.html` checkout handler and `#contactForm` submit handler
- **Problem:** Checkout clears the local cart and displays an order-received toast; contact resets the form and displays a sent toast. Neither handler makes a request or persists the submitted information.
- **Severity:** Medium
- **Evidence:** Source event handlers only change local state/DOM; no fetch/API/Sheets integration is present. The behavior was code-reviewed, not browser-tested.
- **Recommended correction:** Connect a real endpoint and show success only after its confirmed response, or make the controls explicitly demo-only and avoid implying delivery.
- **Dependencies:** Cafe ordering/contact workflow and backend choice.

### SEC-09 — Dashboard CI lint command can fail before analyzing source

- **Repository:** admin_dashboard
- **File or route:** `package.json` `lint`
- **Problem:** `next lint` enters interactive configuration and exits rather than producing a deterministic lint result.
- **Severity:** Low
- **Evidence:** Direct invocation opened an interactive prompt and exited nonzero.
- **Recommended correction:** Pin the ESLint config and invoke ESLint CLI noninteractively.
- **Dependencies:** Lint configuration.

## Positive controls observed

- Dashboard Sheets client and repository import `server-only`; keys are read from non-public environment variables. Browser examples do not use Google credentials.
- Dashboard separates platform data/auth in Supabase from per-store Sheets business data, and the safe Sheets metadata type omits spreadsheet ID/URL.
- Store Admin assignment is obtained from the authenticated server session. `AsyncLocalStorage` carries store scope; registry access is scoped server-side. Admin security test suite passes 7/7.
- Dashboard Sheets API maps common HTTP errors to localized messages, applies a timeout, retries retryable reads/updates and records API failures. It does not retry append POST automatically.
- ORVANTE uses email one-time codes, hashed code/session storage, expiry/attempt throttles, admin email from Script Properties, server-side price/stock checks, idempotency, and a script lock in the tested code path. Mock tests pass 15/15. Live Google execution is still unverified.
- Axora uses Supabase browser-safe public keys separately from service-role server configuration. SQL migrations and RLS are present; live policy verification was not part of this audit.
- Local `.env.local` values were not read or included in reports. Git checks show those files are not tracked in the examined projects. Dashboard and Axora `.gitignore` files exclude local environment files.

## Required security acceptance

1. Production-start configuration rejects demo auth, placeholder secrets and local emulator mode.
2. Two-tenant tests cover read/write/list/search/export/backup/restore and forged IDs across every server action/API.
3. Production browser artifacts and RSC payloads contain no service-role keys, Google private keys, spreadsheet IDs/URLs, or secret references.
4. Public checkout validates price, inventory, idempotency, CORS/origin policy, request bounds, and abuse rate limits server-side.
5. Staging Google tests verify private workbook sharing and tenant isolation without using customer data.
6. Error logs, export files and notification/audit metadata are checked for PII and credentials.
