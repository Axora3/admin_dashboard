# Google Sheets Audit

**Audit date:** 2026-11-09. Spreadsheet identifiers, URLs, private keys, tokens, and local environment values are intentionally excluded.

## Integration inventory

| Repository | Integration and authentication | Spreadsheet ownership/mapping | Verification |
|---|---|---|---|
| Axora | No Google Sheets API/client integration found. Google Sheets references are product/help copy only. Platform persistence is Supabase. | Not applicable. | Source search only; no live test. |
| admin_dashboard | Server-only REST client in `src/lib/google/sheets-client.ts`. It signs an RS256 service-account JWT, exchanges it at Google OAuth token endpoint, then calls Sheets API v4. | A separate `StoreSheetsConfig` per store holds spreadsheet ID/URL, tab names, and column maps in the platform registry. `Store Admin` receives a safe metadata subset; the Super Admin connection action performs inspection. | No Google credentials in dashboard `.env.local` key names. Local emulator path selected by config unless runtime environment injects credentials. Real API access unverified. |
| online_store_template | Google Apps Script `SpreadsheetApp` under owner authorization; browser calls Apps Script server functions via `google.script.run`. | One workbook ID currently hard-coded in Apps Script source; fixed to that store project. Keep the identifier private in operational docs. | Mock tests pass. README says authorization, initialization, Web App deployment, and live workbook test are pending owner tasks. |
| online_store_template_2 | None. | None. | Orders optionally leave the app through an HTTP webhook; no Sheets connection. |
| coffe_shope_template | None found. | None. | Static source only. |
| business_profile_template | None found. | None. | Static source plus optional contact endpoint. |

## Dashboard service-account and API path

- Accepted credential inputs: `GOOGLE_SERVICE_ACCOUNT_JSON` (JSON or base64-encoded JSON), or `GOOGLE_SERVICE_ACCOUNT_EMAIL` plus `GOOGLE_PRIVATE_KEY`; optional `GOOGLE_PRIVATE_KEY_ID` contributes JWT key ID. Dashboard `.env.example` documents Google credentials; current `.env.local` does not declare them. Values were never printed.
- Credential use is server-only (`import "server-only"`), held in environment variables, and used to request an OAuth token scoped to Sheets. The token is cached in process memory for its expiry window. No Google key is named with `NEXT_PUBLIC_`.
- Spreadsheet IDs are obtained from per-store mapping, not a single code constant. `extractSpreadsheetId()` accepts ID or Docs URL. The client uses REST endpoints for metadata, value reads/writes/appends, batch updates, tab creation, row deletion, and workbook backup/restore.
- API request timeout is 15 seconds. The client retries GET and PUT on HTTP 429/5xx up to three attempts with backoff; it clears cached auth on 401, emits failure telemetry, and maps common 401/403/404/429/5xx cases to localized messages. POST is not automatically retried, reducing duplicate append risk. This behavior is code-verified only.
- A 20-second in-process read cache exists in `google-repository.ts`. Mutation paths invalidate it and server actions revalidate dashboard storefront paths. This is not evidence of real-time sync to separately deployed customer projects.
- The full read range is `A:ZZ`; no pagination/chunking is visible in that adapter. Large workbooks can raise latency/quota exposure. There is no live quota/load measurement.

## Dashboard workbook contract

Tab names are configurable per store. Defaults and semantic fields are in `src/lib/google/types.ts`. Headers can be mapped to existing names; required columns are validated before connection save. The default names below are contract defaults, not verified live tab names.

| Resource | Default tab | Default columns and data formats |
|---|---|---|
| Products | `Products` | `ID`, `Name`, `Slug`, `Description`, `Price`, `SalePrice`, `Stock`, `SKU`, `CategoryID`, `Images`, `Variants`, `IsActive`, `IsFeatured`, `IsNew`, `CreatedAt`, `UpdatedAt`. Images and variants serialize as JSON arrays; booleans/numeric values are parsed from cell strings. Required semantic fields: id/name/price/stock. |
| Categories | `Categories` | `ID`, `Name`, `Slug`, `Description`, `ImageURL`, `SortOrder`, `CreatedAt`. Required: id/name. |
| Orders | `Orders` | `ID`, `OrderNumber`, `CustomerName`, `CustomerPhone`, `CustomerEmail`, `CustomerAddress`, `Note`, `Subtotal`, `ShippingAmount`, `TotalAmount`, `PaymentStatus`, `OrderStatus`, `Delivery`, `Items`, `CreatedAt`, `UpdatedAt`. `Delivery` is JSON; `Items` is a JSON array. Required: id/order number/customer name/total/order status/created date. |
| Customers | `Customers` | `ID`, `Name`, `Phone`, `Email`, `OrderCount`, `TotalSpent`, `FirstOrderAt`, `LastOrderAt`. Required: id/name. |
| Settings | `Settings` | `Key`, `Value`; values are stored as strings. |
| Inventory | `InventoryLogs` | `ID`, `ProductID`, `ProductName`, `ChangeAmount`, `BalanceAfter`, `Reason`, `Note`, `ActorName`, `CreatedAt`. Required: id/product/change/date. |

API data is read with `UNFORMATTED_VALUE`; date-time values can arrive as Google serial numbers and `toIso()` converts them. Writes use `RAW`. The adapter includes row append/update/delete, cell-level patching, and non-destructive header extension. Delivery tests verify preservation of unrelated cells/formulas in mocks. `toNumber()` strips commas and non-numeric characters; locale-formatted decimal input should be tested because comma decimals can be misread.

## ORVANTE Apps Script workbook contract

`apps-script/Code.gs` declares fixed tables and `initializeStore()` creates missing tabs and headers without clearing existing data. The workbook ID lives in source, rather than a per-site deployment setting.

| Tab | Columns (header row) | Use/formats |
|---|---|---|
| Products | `id`, `name`, `category`, `price`, `stockTotal`, `active`, `updatedAt`, `data` | Store source record in JSON `data`; index columns support human review. |
| Users | `id`, `email`, `name`, `phone`, `createdAt`, `updatedAt` | User identity/profile; password is not stored. |
| Orders | `id`, `userId`, `email`, `status`, `total`, `createdAt`, `requestId`, `fingerprint`, `data` | Order and item details serialized in JSON `data`; idempotency key/fingerprint columns. |
| Sessions | `hash`, `userId`, `expiresAt` | Token hash only; server enforces 24-hour session expiry. |
| LoginCodes | `email`, `hash`, `expiresAt`, `attempts`, `sentAt`, `windowStart`, `sentCount` | One-time email code hash and throttle/expiry fields. |

Script Properties documented in README: `ADMIN_EMAIL`, `CONTACT_PHONE`, `CONTACT_EMAIL`, optional bank details, generated `AUTH_SECRET` and `READY`. Apps Script is deployed as the owner; workbook stays restricted. The README documents 60-second per-email spacing, five codes/hour/email, 30/hour global, MailApp remaining-quota check, code expiry/attempt limit, and a script lock. These controls were verified in code and mocks, not in a live Google account. Apps Script/Google quotas can still constrain throughput.

## CRUD and visibility assessment

- **admin_dashboard:** source contains product/category/order/customer/settings/inventory operations and maps each store to its own workbook. Mock delivery tests and code-level invalidation support internal dashboard storefront refresh. Full live Sheets CRUD and end-to-end public storefront visibility are **unverified**.
- **online_store_template:** Apps Script handlers implement catalog, admin product create/edit/activate, checkout/order, status update/cancel, user profile/history. Mock tests establish server-side rule behavior, not actual spreadsheet permissions, formulas, or API quotas. Live CRUD is **unverified**.
- **Other three repositories:** no Google Sheets CRUD exists in source. `online_store_template_2` has an optional webhook only; the business and coffee templates are static.

## Exposure and tenant boundaries

- Dashboard service-account credentials remain server-side in the code reviewed. Public `StoreSheetsMeta` intentionally excludes spreadsheet ID/URL; store tabs and column maps are included for admin UI use. Store assignment is resolved from server auth context and repository scoping.
- Dashboard’s per-store spreadsheet IDs and mapping live in the platform registry. Security depends on keeping privileged registry reads behind Super Admin/server paths and applying tenant-scoped store access; isolated security tests pass.
- ORVANTE’s spreadsheet ID is in Apps Script source. It is not an API credential, but is a fixed identifier and should move to Script Properties for safe multi-site provisioning. No service-account private key is used by that template.
- No spreadsheet identifier or credentials are printed in this report. No credential appeared under `NEXT_PUBLIC_*` in the reviewed examples.

## Required staging proof before claiming Sheets works

1. Provision two disposable stores with distinct private workbooks and service-account share permissions.
2. Inspect metadata/tabs/header mapping; reject invalid permissions and missing required columns without replacing the prior saved mapping.
3. Exercise create/update/delete for products, categories and order status; test inventory concurrency, backup/restore and delivery fields.
4. Verify no ID/key is present in browser payloads, HTML, client bundles, error messages, logs or downloads.
5. Verify the same changed data appears on each intended public storefront, record the actual consistency window, and prove store A cannot read/write store B.
6. Exercise Google 403/404/429/5xx, timeout, quota exhaustion, malformed data, duplicate requests and recovery. The current audit did not perform these external checks.
