# AXORA billing contract

Consumer: separate admin_dashboard server. Provider: AXORA. This document specifies the new adapter; it does not claim AXORA already implements the endpoint. No provider repository was modified.

Server configuration: `AXORA_BILLING_API=https://<authoritative-host>/<base-path>` and `AXORA_BILLING_TOKEN=<server-only-token>`. The base URL must have no query, fragment or embedded credentials. Redirects are rejected. Requests have an eight-second timeout and no caching.

Request: `GET {base}/sites/{url-encoded-site_id}/billing`, `Authorization: Bearer <token>`, `Accept: application/json`. The dashboard derives site_id from current authorized membership. AXORA must independently authorize the service token and site scope. The browser never receives the token.

Example **contract illustration only**, not customer/payment data:

```json
{
  "site_id": "example-site-id",
  "as_of": "2026-11-10T00:00:00Z",
  "confirmed_delivery_at": null,
  "subscription": {
    "status": "awaiting_delivery",
    "plan": null,
    "next_billing_at": null
  },
  "payments": []
}
```

Timestamp values are ISO UTC strings or nullable where illustrated. Allowed subscription status: awaiting_delivery, trial, active, past_due, suspended, cancelled, expired. Plan: monthly, annual or null. Payment history: at most 200 entries, each `{id,status,amount,currency,created_at,paid_at}`. Currency must be MNT, amount a finite nonnegative number, paid_at nullable. Payment status: pending, paid, failed, refunded, cancelled. AXORA should return the latest 200 entries until pagination is implemented.

The response site_id must exactly match the authorized request. A trial response without confirmed_delivery_at is rejected. The dashboard computes the trial end as confirmed delivery plus 30 days, displays the source as_of date, and trusts AXORA's returned status rather than inventing status transitions. A missing/unavailable/invalid source displays unavailable. No local billing records or fake payment confirmations are substituted.

The listed prices are product requirements, not evidence of payment or an invoice: monthly 20,000 MNT; annual 228,000 MNT; annual saving 5%. Taxes, payment gateway, reconciliation, checkout and billing changes remain AXORA responsibilities. Configure a real source and test its authorization and statuses before production use.
