# Google Sheets Setup and Provisioning

## Required secrets and scopes

- Store service-account JSON or discrete email/private-key values only in the dashboard server’s managed secret store/environment. Do not put them in any `NEXT_PUBLIC_*` variable, template source, spreadsheet, browser storage, or issue.
- Enable Google Sheets API and Google Drive API. Use Sheets scope plus Drive `drive.file` for app-created spreadsheets and idempotency-marker lookup.
- Give the service account access only to the workbooks it manages. A spreadsheet ID is a locator, not authorization.
- Keep all customer records in their own spreadsheet. Supabase stores site identity, membership, integration mapping and operational metadata only.

## Site setup

1. Create or select a site in the separate Customer Dashboard; verify business type, owner membership and active verified domain.
2. Choose enabled modules from that business type’s registry.
3. Start provisioning from the site detail page; the Super Admin action creates a UUID idempotency key and retains it for retries during that page session. Reusing the key finds the same workbook through Drive `appProperties`.
4. Wait for status `connected`; the server validates spreadsheet metadata, tabs, headers and read/write probe before saving the mapping.
5. If provisioning returns an error, inspect sanitized attempt code/status in the dashboard. Do not retry with a new key until the old attempt is reconciled.
6. Add dashboard members through the authenticated membership workflow. Do not share a spreadsheet ID as a permission grant.
7. Verify public site reads from its verified domain and create-only visitor submission path on staging.

## Environment contract

Existing dashboard variables are documented in `.env.example`. Add/retain server-only Google credentials and an explicit Sheets mode. Template 2 uses server-only `AXORA_PUBLIC_DATA_API`; the Vite business-profile template uses public `VITE_AXORA_DATA_API`; the coffee template uses a public API-base meta tag. These are endpoint URLs, not secrets. Do not add credentials to any of the four template repositories.

For templates, configure only the dashboard API origin and customer website domain/site binding through build/deployment metadata. These are identifiers, not secrets. Static templates receive no spreadsheet mapping.

## Provisioning behavior

- Default tab names and headers come from [SHEET_SCHEMA_REGISTRY.md](SHEET_SCHEMA_REGISTRY.md).
- The Drive file stores an opaque idempotency marker. Site registry metadata stores the generated spreadsheet reference, schema version, integration status, sync times and sanitized failure name. A separate durable attempt ledger is not implemented yet.
- Drive `appProperties` contains an opaque marker derived from the idempotency key; it does not contain customer PII or a credential.
- The service account creates the workbook and initializes tabs. Existing workbook configuration is not replaced until preflight succeeds.
- Probe operations use a dedicated hidden/health tab or reversible metadata write. Never insert fake customer orders/products as a probe.
- If a process loses the API response, the Drive marker lets the next attempt find the original workbook.

## Operations

- Monitor Google 429 and 5xx, timeout, 401/403/404, invalid mapping, missing schema and partial provisioning status.
- Reads use bounded ranges and a 15-second public projection cache. Mutations use a site/resource operation lock and optimistic record version. Rate limits and cache are process-local in this increment.
- Keep request/audit logs free of credentials, full sheet contents and unnecessary customer data.
- Disable an integration without deleting its workbook. Deletion of a workbook or tab is a separate, audited maintenance action.

## Current live status

The local audit environment does not have Google service-account credentials. Setup documentation and mocked tests do not prove live API connectivity. Use a disposable Google project/workbook for acceptance; never describe the integration as connected until that real check passes.

## Multi-tenant customer dashboard

For the new customer membership migration, business-specific modules including portfolio, explicit schema preparation and AXORA billing source setup, see `CUSTOMER_DASHBOARD_IMPLEMENTATION.md`, `AXORA_BILLING_CONTRACT.md` and `CUSTOMER_DASHBOARD_QA.md`. These documents distinguish local emulator verification from the real Google/Supabase/deployed website checks that still need staging credentials and access.
