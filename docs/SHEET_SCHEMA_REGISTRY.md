# Sheet Schema Registry

**Schema version 1 is declared in `src/lib/google/schema-registry.ts`.** Each business type owns its own module set and records. `ID`, `CreatedAt`, `UpdatedAt`, `DeletedAt`, `IdempotencyKey`, and `Data` are common control columns. `ID` is the stable identifier; row numbers are private write coordinates. `Data` stores JSON extension fields so additive extensions do not require destructive column rewrites.

## Online store

| Tab/module | Required fields | Additional fields / formats |
|---|---|---|
| Products | `id`, `name`, `slug`, `price`, `stock` | `description`, `salePrice`, `sku`, `categoryId`, `images` JSON, `variants` JSON, `isActive`, `isFeatured`, common columns |
| Categories | `id`, `name`, `slug` | `description`, `sortOrder`, common columns |
| Orders | `id`, `orderNumber`, `status`, `totalAmount`, `items` JSON | `customerId`, `customerName`, `customerPhone`, `customerEmail`, `deliveryFee`, `shipping` JSON, `paymentMethod`, common columns |
| Customers | `id`, `name` | `phone`, `email`, common columns |
| Inventory | `id`, `productId`, `changeAmount`, `reason` | `balanceAfter`, actor/note, created date, common columns |
| Settings | `id`, `key`, `value` | `value` is JSON-compatible text; timestamps/common columns |

## Restaurant / coffee shop

| Tab/module | Required fields | Additional fields / formats |
|---|---|---|
| Menu | `id`, `name`, `price`, `isAvailable` | `description`, `categoryId`, `allergens` array, `options` JSON, common columns |
| Categories | `id`, `name`, `sortOrder` | `description`, common columns |
| Orders | `id`, `status`, `items` JSON, `totalAmount` | `customerName`, `phone`, `fulfillmentType`, `requestedAt`, `note`, timestamps/common columns |
| Reservations | `id`, `customerName`, `phone`, `partySize`, `reservedAt`, `status` | `email`, `note`, timestamps/common columns |
| OpeningHours | `id`, `weekday`, `opensAt`, `closesAt` | `isClosed`, `timezone`, effective dates, common columns |
| Settings | `id`, `key`, `value` | JSON-compatible text and common columns |

## Service business

| Tab/module | Required fields | Additional fields / formats |
|---|---|---|
| Services | `id`, `name`, `durationMinutes` | `description`, `price`, `currency`, `isActive`, common columns |
| Appointments | `id`, `serviceId`, `customerName`, `startsAt`, `status` | `staffId`, `customerId`, `phone`, `email`, `note`, timestamps/common columns |
| Staff | `id`, `name`, `isActive` | `email`, `phone`, `serviceIds` JSON, availability JSON, common columns |
| Customers | `id`, `name` | `phone`, `email`, common columns |
| Settings | `id`, `key`, `value` | JSON-compatible text and common columns |

## Business profile

| Tab/module | Required fields | Additional fields / formats |
|---|---|---|
| Pages | `id`, `slug`, `title`, `body`, `status` | `summary`, `seo` JSON, `sortOrder`, published timestamps, common columns |
| Gallery | `id`, `title`, `mediaUrl`, `status` | `alt`, `caption`, `category`, `sortOrder`, common columns |
| Articles | `id`, `slug`, `title`, `body`, `status` | `summary`, `author`, `publishedAt`, `seo` JSON, common columns |
| ContactInquiries | `id`, `name`, `message`, `status` | optional `email`, `phone`, `subject`, common columns |
| Settings | `id`, `key`, `value` | JSON-compatible text and common columns |

## Extension and migration rules

- Schema version is explicit in site integration config and provisioning records.
- Add optional columns only; do not reorder, rename, or delete existing headers automatically.
- Unknown JSON keys in `data` round-trip unchanged. Unknown standard columns are preserved by cell-level patches.
- A schema migration reads and validates first, writes only additive changes, verifies, then increments `schema_version` and `configuration_version`.
- Module disablement hides/routes data but does not delete tabs or rows.
- Delete in the typed adapter is a confirmed soft delete (`DeletedAt`); public projections and the legacy dashboard reader hide tombstoned rows.
- The existing e-commerce schema is treated as a legacy-compatible v1 mapping. Existing custom headers continue through configured column maps; no bulk rewrite is part of onboarding.

## Business type to modules

| `business_type` | Allowed modules |
|---|---|
| `online_store` | Products, Categories, Orders, Customers, Inventory, Settings |
| `restaurant` | Menu, Categories, Orders, Reservations, OpeningHours, Settings |
| `service_business` | Services, Appointments, Staff, Customers, Settings |
| `business_profile` | Pages, Gallery, Articles, ContactInquiries, Settings |

Reject resource/business-type mismatches server-side. Custom modules require an explicit registry extension and schema version bump.
