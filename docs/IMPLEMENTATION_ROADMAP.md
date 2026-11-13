# Implementation Roadmap

The sequence below is based on verified audit findings. It does not authorize broad implementation; the audit should be reviewed before any cross-repository changes.

## P0 — Establish safe production boundaries

1. **Fail closed on dashboard production auth configuration.** Remove automatic path to known local credentials outside development; require explicit auth mode, strong secret, and production env validation.
2. **Make customer order creation authoritative.** For template 2, validate identifiers and quantities, load server-side products/prices, compute totals, enforce idempotency/rate limits, and persist or clearly return demo status.
3. **Define data ownership and tenant contract before factory work.** Decide dashboard registry responsibility, which system owns each store’s Sheets mapping, which templates may write customer data, and how independently deployed sites refresh.
4. **Staging proof for Google Sheets.** Use two disposable stores/workbooks to verify credentials, mapping, CRUD, error handling, tenant isolation and dashboard storefront visibility. Do not represent untested integrations as live.

**Dependencies:** production deployment inventory; staging Supabase/Google projects; data-flow decision; no live customer data required.

## P1 — Make current applications reproducible and testable

1. Fix dashboard SaaS notification test fixture to use UUID, retain guard, rerun suite.
2. Replace interactive dashboard lint script with explicit ESLint configuration/CLI and CI invocation.
3. Bundle Google Fonts locally (Axora, template 2) or establish a deterministic, documented font build step; rerun production builds in CI.
4. Add contract tests for dashboard Google REST adapter covering 401/403/404/429/5xx, timeout, malformed headers, large ranges, duplicate writes and cache invalidation.
5. Add tests for template 2 webhook absent/present and malicious client totals.
6. Add owner-controlled Apps Script staging checklist and verify its RPC responses, quotas, sheet permissions, and real email delivery before rollout.

**Dependencies:** CI environment, font licensing/assets, isolated mocks/staging resources.

## P2 — Standardize template provisioning, not repository structure

1. Create the future factory project only after agreeing on a versioned template manifest and API/data adapter contract.
2. Move ORVANTE workbook ID to Script Properties and provide per-deployment setup validation.
3. Decide which static templates remain content-only and which are commerce-enabled; document unsupported operations in their setup metadata.
4. Add placeholder-content checks for business profile and static product fixtures before deployment.
5. Define per-template environment schema, deployment type, health endpoint, smoke tests, and safe rollback.

**Dependencies:** architecture review, customer onboarding fields, deployment provider choice.

## P3 — Production readiness and operability

1. Validate responsive UI/accessibility states at defined phone/tablet/desktop viewports for each project.
2. Add runtime observability for spreadsheet latency/quota failures, webhook delivery, contact submissions, build/deploy status and generated-site health.
3. Define backup/restore responsibilities and retention for every data adapter, including whether a site can be recreated from its manifest.
4. Run two-tenant end-to-end acceptance and disaster recovery in staging.
5. Record production build, deployment, rollback and incident runbooks per independent application.

**Dependencies:** accepted P0/P1 architecture and deployment pipeline.

## Acceptance gates

- **Gate A — Security:** no production demo auth; no client-side secret/mapping exposure; tenant A cannot observe or mutate tenant B.
- **Gate B — Data:** each store maps to the intended workbook/tabs/headers; CRUD and error paths are verified with disposable data; backups restore to the same store only.
- **Gate C — Commerce:** server recomputes amount, enforces stock/idempotency, and reports payment/order state accurately.
- **Gate D — Generation:** factory produces an independent project, deploys it, binds correct store config, verifies health, and can roll back without affecting another site.
- **Gate E — QA:** lint/typecheck/tests/build pass in CI; browser QA covers loading/error/empty states and supported viewports.
