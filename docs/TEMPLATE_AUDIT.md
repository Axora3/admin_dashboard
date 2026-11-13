# Template Audit

All behavior is marked as **code-verified**, **mock-tested**, or **unverified live**. Static content and a passing build do not establish a production backend.

## 1. online_store_template — ORVANTE apparel storefront

- **Category/design:** Mongolian fashion and apparel shop; dark editorial storefront, product cards and detail modal, category/search/sort filters, cart drawer, customer/admin dialogs.
- **Pages/routes:** One HTML document (`index.html`) with in-page sections and modal-driven catalog, checkout, account, order history and store admin. Apps Script Web App serves the app. No separate path-based site pages.
- **Components:** Inline HTML/CSS/JS; `scripts/live-client.js` is embedded into HTML by `scripts/build.mjs`; server functions in `apps-script/Code.gs`.
- **Working features:** Source implements email OTP auth, profile, cart, catalog, product administration, checkout/order history, cancellation, admin order status and stock calculations. `node --test tests/server.test.mjs`: 15/15 pass against mocks. UI visibly handles disconnected catalog, errors and empty lists in source.
- **Missing/unverified:** Owner authorization, workbook sharing, live email delivery, Apps Script deployment, real-sheet CRUD and browser/mobile behavior are not verified. No automated publish pipeline. README says cards/QPay are not integrated and bank transfer is manual; product photos require HTTPS URLs.
- **Sheets:** Owner-run Apps Script, one fixed workbook ID, restricted workbook. Tabs/columns are fully listed in [GOOGLE_SHEETS_AUDIT.md](GOOGLE_SHEETS_AUDIT.md). Data source of truth is JSON in Products/Orders `data` cells plus index columns.
- **Environment/properties:** Apps Script Script Properties `ADMIN_EMAIL`, `AUTH_SECRET`, `READY`, optional contact/bank properties. No `.env` variables.
- **API contract:** Browser uses `google.script.run` RPC with `{action, ...payload}` and receives `{ok, data}` or `{ok:false,error,code}`. Actions include catalog, auth code request/verification, me/logout/profile, my orders, place order, cancel order, adminList, saveProduct, setProductActive, setOrderStatus. Actual UI/handler pair is code-verified; Google deployment is not.
- **Known risks:** Source-fixed spreadsheet identifier; global ScriptLock serializes writes; Apps Script mail/runtime quota; no tested deployment URL or live-sheet error UX.
- **Checks:** 15 mocked server tests pass; no build/deploy run because the HTML build script rewrites both source and Apps Script HTML.

## 2. online_store_template_2 — multi-category demo commerce store

- **Category/design:** General e-commerce demo spanning electronics, home, fashion, beauty, and accessories; image-rich catalog with hero, search, filters, cart, product options, checkout and informational pages.
- **Pages/routes:** `/`, `/products`, `/categories`, `/sale`, `/about`, `/contact`, `/checkout`, `/privacy`, `/terms`, `/api/orders`; metadata sitemap and robots routes.
- **Components:** Header/footer, catalog, product cards/options/modal, cart drawer/context, checkout/contact forms, hero panels, reveal observer, toast/search overlay. Product fixtures reside in `lib/products.ts`.
- **Working features:** Browse/filter/cart UI and checkout form validation against local product fixtures. TypeScript check passes. No test suite or lint command is declared.
- **Missing/unverified:** No durable catalog, auth, admin CRUD, inventory reservation, customer/order database, or Sheets adapter. QPay/bank options themselves identify backend requirement. Without a webhook, route explicitly returns `demo:true` and does not save an order. Webhook branch does not calculate totals or validate item prices server-side.
- **Sheets:** None. Required tabs/columns: none.
- **API contract:** `POST /api/orders` accepts customer `{firstName,lastName,phone,email}`, address, paymentMethod, `items[]` including productId/name/quantity/unitPrice, totals. Optional `ORDER_WEBHOOK_URL` receives the original client payload plus source/receivedAt and optional bearer `ORDER_WEBHOOK_SECRET`. No webhook response schema is enforced beyond optional orderId/paymentStatus/message.
- **Environment:** `ORDER_WEBHOOK_URL`, `ORDER_WEBHOOK_SECRET`; absent `.env.example` means deployment docs should define both.
- **Known risks:** Client-controlled price/totals pass through; no rate limiting/idempotency shown; build needs Google Fonts network access.
- **Checks:** `npx tsc --noEmit` passes. Isolated `next build` fails fetching Inter from Google Fonts in this restricted environment. No live webhook/payment test.

## 3. coffe_shope_template — MORI COFFEE cafe landing/menu

- **Category/design:** Coffee shop; espresso/cream palette, Poppins/Manrope, single-page branded experience and a remote Three.js module import map.
- **Pages/routes:** One large `index.html`; no app router or backend routes detected.
- **Components:** Inline markup, CSS, and JavaScript; no reusable component framework or package manifest.
- **Working features:** Source implements section navigation, menu category filtering, cart editing with browser `localStorage`, dialog focus handling, and reduced-motion/3D presentation. These interactions were code-reviewed but not browser-executed.
- **Missing/unverified:** No admin menu editor, order/payment backend, auth, Sheets integration, analytics endpoint, or deployment configuration found. The checkout button clears the cart and shows “order received” locally without sending an order; the contact form resets and says sent without transmitting the message. Actual asset/network accessibility and responsive behavior were not browser-tested.
- **Sheets:** None; no required tabs/columns/API contract.
- **Environment:** None identified. Fonts and Three.js are externally loaded.
- **Known risks:** Monolithic file, remote dependency availability, local-only cart, success-shaped checkout/contact stubs, no backend-backed empty/error/loading states, customer-specific menu/contact details needed before publishing.
- **Checks:** No package/test/build manifest; no check run.

## 4. business_profile_template — architecture/engineering company profile

- **Category/design:** Architecture, engineering and planning services; editorial one-page corporate profile with restrained earth palette, project imagery, reveal and parallax motion.
- **Pages/routes:** One Vite page composed from Home, About, Services, Projects, WhyUs, Contact, Footer, and navigation sections. No detail routes.
- **Components:** React sections, reusable buttons/logo/social links/reveal/media reveal/back-to-top, reduced-motion/parallax/reveal hooks; centralized data in `src/data/company.ts`.
- **Working features:** Content-driven sections and contact form validation. TypeScript check and Vite production build pass. When endpoint is absent, form opens a prefilled mail draft; automatic delivery is not established.
- **Missing/unverified:** No CMS/admin, auth, persistent contact storage, Sheets integration or analytics. Company details, project descriptions and images are expressly demo content. Real endpoint behavior and responsive browser appearance unverified.
- **Sheets:** None; no required tabs/columns/API contract.
- **Environment:** None defined. `src/components/Contact.tsx` currently declares an empty `CONTACT_ENDPOINT` source constant; changing it requires a code edit/rebuild.
- **Known risks:** Sample portfolio/contact details must be replaced; mailto fallback can be mistaken for submission if user-facing copy is not precise.
- **Checks:** `npx tsc --noEmit` passes; `npm run build` passes in an isolated copy.

## Shared template findings

| ID | Repositories | Problem | Severity | Evidence | Recommended correction | Dependencies |
|---|---|---|---|---|---|---|
| TM-01 | All four templates + admin_dashboard | Four different data models and integration surfaces; no documented versioned provisioning contract links a generated site to its store. | High | Apps Script schema vs six-tab dashboard schema vs webhook vs static project code. | Design the factory manifest and capability contract before implementation. | Future factory and tenant/deployment model. |
| TM-02 | online_store_template_2 | Webhook forwards client totals/prices and has no persistence in demo mode. | High | `app/api/orders/route.ts`; see AX-05. | Validate/reprice server-side, persist idempotently, and keep the demo result explicit. | Catalog and payment/order backend. |
| TM-03 | online_store_template | One workbook ID is hard-coded in `Code.gs`; live GAS rollout is still an owner step. | Medium | `SHEET_ID_`; README deployment checklist; 15 mocked tests. | Move ID to Script Properties and perform disposable staging acceptance. | GAS provisioning instructions. |
| TM-04 | coffe_shope_template | Monolithic static page without API/backend or automated checks. | Medium | One HTML source; no package manifest. | Keep it a static starter if intended; otherwise define orders/menu backend and add a safe test harness before selling it as a managed commerce template. | Product capability decision. |
| TM-05 | business_profile_template | Demo company content and optional mailto contact path. | Medium | `src/data/company.ts`, `src/components/Contact.tsx`. | Make content injection and endpoint choice explicit in factory setup. | Customer onboarding/content model. |
| TM-06 | Axora and online_store_template_2 | Production build requires Google Fonts at build time. | Medium | Build errors at `next/font`; see AX-08/09. | Bundle fonts or provide build network and lock availability in CI. | Font licensing and build pipeline. |
| TM-07 | coffe_shope_template | Checkout and contact form show success and clear/reset local state without sending a request. | Medium | `index.html` checkout handler clears cart and toasts; contact handler resets form and toasts; no fetch/backend source found. | Connect a real order/contact endpoint or change the UI to label these controls as demo interactions. | Cafe ordering/contact requirements and backend decision. |

