# Dependency Map

## Application boundaries

```mermaid
flowchart LR
  ax[Axora platform\nNext.js + Supabase] -->|selects/orders/requests| supa[(Axora Supabase project)]
  adm[admin_dashboard\nNext.js] -->|identity, registry, platform ops| supa2[(Dashboard Supabase project)]
  adm -->|server service account\nper-store mapping| sheets[(Store Google Sheets)]
  adm -->|same app paths + cache invalidation| sf[Dashboard-hosted /store/[slug]]
  t1[online_store_template\nHTML + Apps Script] -->|owner-executed RPC| gas[Google Apps Script]
  gas -->|SpreadsheetApp| wb[(One store workbook)]
  t2[online_store_template_2\nNext.js demo] -->|optional POST| hook[ORDER_WEBHOOK_URL]
  t3[coffe_shope_template\nstatic HTML] -->|no backend found| browser[Browser]
  t4[business_profile_template\nVite static profile] -->|optional contact endpoint| contact[CONTACT_ENDPOINT]
  factory[axora-website-factory\nplanned, absent] -. provisions independent projects .-> generated[Independent customer websites]
```

The boxes represent separate applications and backends. No repository merge or shared deployment is implied. The current code does not show a verified dependency from Axora to admin_dashboard, from the dashboard to the template Apps Script workbook, or from either to a generated site. The factory is planned and absent.

## Repository dependency table

| Application | Runtime dependencies | Data dependencies | Integration direction/status |
|---|---|---|---|
| Axora | Next.js 16 / React 19 / TypeScript 5 / Tailwind 4 | Supabase Auth, Postgres, Storage; SMTP/email configuration | Standalone platform. No customer Sheets adapter found. Live provider setup unverified. |
| admin_dashboard | Next.js 15 / React 19 / TypeScript 5 / Tailwind 3 | Supabase for accounts/assignments/registry/platform controls; Google Sheets per store; `.data` JSON emulator for local mode | Standalone customer/store admin and app storefront. Writes revalidate its own app; independent generated-site refresh is undefined. |
| online_store_template | Browser HTML/JS + Google Apps Script runtime | One private Google workbook; Apps Script Properties; Google MailApp | Standalone single-store template. Owner must authorize and deploy manually. |
| online_store_template_2 | Next.js 14 / React 18 / TypeScript 5 / Tailwind 3 | In-repo static product fixtures; optional webhook | No dashboard/Sheets adapter. Webhook has no verified receiver. |
| coffe_shope_template | Browser HTML, inline CSS/JS, remote Google Fonts/Three.js | Browser-local cart only; checkout/contact handlers do not send data | Static landing/menu template with success-shaped checkout/contact stubs. |
| business_profile_template | Vite 8 / React 19 / TypeScript 7 / Tailwind 4 | Source data module and local image assets; contact endpoint is an empty source constant unless edited | Static profile. No dashboard/Sheets adapter. |
| axora-website-factory | Not present | Not present | Planned automation engine. Contracts, deployment orchestration, secrets boundary and generated-project lifecycle remain design dependencies. |

## Important version/build boundaries

- The apps declare different Next/React/Tailwind/TypeScript versions. They are independent repositories; this is not itself an error and should not be “fixed” by merging package manifests.
- Axora and online_store_template_2 build paths fetch Google Fonts at build time. Both builds failed under the current network restriction.
- Dashboard’s build passes on the current checkout. Its lint command is not deterministic/noninteractive.
- Google service account belongs only in dashboard server environment. ORVANTE Apps Script runs under its owner identity and uses Script Properties; it should not inherit dashboard credentials.
- `ORDER_WEBHOOK_SECRET` should be shared only with the receiving server. It must not become a `NEXT_PUBLIC_*` variable.

## Future factory integration dependencies

1. Define a versioned project manifest describing template ID/version, customer/store ID, domains, data adapter, allowed variables, deployment target, and health check.
2. Keep provisioning credentials and Google secrets in server-side secret storage; generated repositories receive only narrowly scoped server integration configuration.
3. Decide whether each generated store uses the dashboard Sheets adapter, its own backend, or Apps Script. Do not assume the existing schemas are interchangeable.
4. Define data-change notification/cache invalidation between dashboard and separately deployed sites.
5. Define supported runtime/toolchain per starter, smoke-check contract, rollback and ownership of deployed artifacts.
6. Preserve independent projects/deployments, per the specified architecture.
