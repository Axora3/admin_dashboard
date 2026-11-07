# AXORA multi-role administration

## Deployment

1. Apply existing SQL migrations 0001–0004, then `supabase/migrations/0005_admin_accounts.sql` through the Supabase SQL editor or your migration runner. Back up the identity schema first. The migration enforces one Super Admin and one primary assignment per store. It intentionally fails if existing data contains multiple Super Admins: reconcile those accounts first.
2. Configure `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, server-only `SUPABASE_SERVICE_ROLE_KEY`, `AXORA_AUTH_MODE=supabase`, and `AXORA_APP_URL` (the canonical HTTPS admin origin, without a trailing slash). Configure Google Sheets and a persistent `AXORA_DATA_DIR` as described in README.
3. In Supabase Authentication settings, **disable new user signups**. Enable email/password sign-in, configure production SMTP, set Site URL to `AXORA_APP_URL`, and allow the `/auth/callback` redirect URL. There is no registration UI or registration server action.
4. Set the Supabase **Reset Password** email template link to:

   ```html
   <a href="{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}">Set your AXORA password</a>
   ```

   This token-hash flow is necessary because Super Admin initiates recovery on another person's behalf. It works in the recipient's browser without requiring the initiating browser's PKCE verifier. The callback always verifies a recovery token through Supabase; the application never stores passwords or recovery tokens.
5. Run `npm run setup:admin` to provision the platform owner. Existing Store Admins must be explicitly created/assigned under `/admin/admins`; legacy `store_owner`/`store_staff` profiles are not automatically granted access.

Local authentication deliberately remains Super Admin only. Account management displays a configuration notice in local mode. Live provider credentials, migrations, SMTP delivery and Google API access were not exercised by the local tests.

## Behavior

- Login redirects Super Admin to `/admin` (existing dashboard redirect) and Store Admin to `/store-admin`. Every page and action independently checks a verified Supabase user and current active profile; Store Admin assignment is read through the server-only service client on each request.
- Store Admin has products, categories, orders, customers, analytics, settings and audit routes. Their interface has no store selector or platform-management actions. IDs from forms and query strings never choose their tenant.
- Async-local tenant scope restricts all underlying registry enumeration/lookups and hence resource-ID scans to the assigned store. Audit queries independently force that same scope. Concurrent requests do not share scope. Credentials and Spreadsheet IDs stay on the server.
- Creating a store in Supabase mode provisions a Store Admin using the owner name/email and sends password setup mail. If provisioning or email delivery fails, the already-created store remains intact and the UI directs the Super Admin to Admin Management with a failure notice. Existing accounts can be reset there without recreating the store. A second primary assignment is rejected by the database unique constraint.
- Admin Management supports name changes, store reassignment, activate/deactivate, last login, password recovery and actor-specific audit history. Disabling writes the profile flag before requesting a provider ban, so application access remains denied if the provider ban fails. Existing application sessions are rejected on subsequent requests. Reassignments take effect on the next request; already-running requests are not cancelled.
- Account records are identity metadata in Supabase, while products, categories, orders, customers and business settings keep the existing per-store Sheets architecture. The assignment table is intentionally separate from legacy SQL business tables because the registry uses text store IDs. Legacy membership-based SQL write permissions are closed by this migration.
- Store mutations record actor, role, store, timestamp, before/after and outcome. Account/password operations are audited without passwords/tokens. Audit records and registry files retain the existing persistent-file adapter; use a single server instance with protected persistent storage until a shared storage adapter is introduced.

This change adds the multi-role system to the existing platform. It does not add the separate backup/restore subsystem from the broader architecture attachment or replace existing domain/Sheets management.

## Verification

```sh
npm run test:security
npm run typecheck
npm run build
```

Security tests cover forged store IDs, cross-store resource enumeration, platform-only mutations, concurrent tenant scopes, disabled accounts, missing assignments, unsupported roles and Super Admin gating. These are isolated application tests; execute an integration check with two actual Supabase accounts and two Sheets before production: sign in to each store, attempt another store's resource ID, disable an account while signed in, and complete emailed password recovery in a separate browser.
