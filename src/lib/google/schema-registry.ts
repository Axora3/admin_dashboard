import { z } from "zod";
import type { BusinessType, SheetModule } from "./data-contracts";

export const SHEET_SCHEMA_VERSION = 1;

export interface SheetField {
  field: string;
  header: string;
  kind?: "number" | "boolean" | "json";
}

export interface ResourceSchema {
  module: SheetModule;
  tab: string;
  fields: SheetField[];
  input: z.ZodObject<z.ZodRawShape>;
  publicFields: string[];
  publicCreate: boolean;
}

const common: SheetField[] = [
  { field: "id", header: "ID" },
  { field: "createdAt", header: "CreatedAt" },
  { field: "updatedAt", header: "UpdatedAt" },
  { field: "deletedAt", header: "DeletedAt" },
  { field: "idempotencyKey", header: "IdempotencyKey" },
  { field: "extensions", header: "Data", kind: "json" },
];

const text = (max = 2000) => z.string().trim().max(max);
const nonNegative = z.number().finite().min(0);
const positiveInt = z.number().int().min(1).max(1000);
const timestamp = z.string().datetime();

const schemas: Record<BusinessType, Partial<Record<SheetModule, ResourceSchema>>> = {
  online_store: {
    products: {
      module: "products", tab: "Products", fields: [...common,
        { field: "name", header: "Name" }, { field: "slug", header: "Slug" },
        { field: "description", header: "Description" }, { field: "price", header: "Price", kind: "number" },
        { field: "salePrice", header: "SalePrice", kind: "number" }, { field: "stock", header: "Stock", kind: "number" },
        { field: "sku", header: "SKU" }, { field: "categoryId", header: "CategoryID" },
        { field: "images", header: "Images", kind: "json" }, { field: "variants", header: "Variants", kind: "json" },
        { field: "isActive", header: "IsActive", kind: "boolean" }, { field: "isFeatured", header: "IsFeatured", kind: "boolean" },
      ],
      input: z.object({ name: text(160).min(1), slug: text(180).min(1), description: text(), price: nonNegative,
        salePrice: nonNegative.nullable().optional(), stock: z.number().int().min(0), sku: text(80).optional(),
        categoryId: z.string().max(128).nullable().optional(), images: z.array(z.string().url()).max(20).default([]),
        variants: z.array(z.object({ name: text(80), values: z.array(text(80)).max(100) })).max(20).default([]),
        isActive: z.boolean().default(true), isFeatured: z.boolean().default(false) }).passthrough(),
      publicFields: ["id", "name", "slug", "description", "price", "salePrice", "stock", "categoryId", "images", "variants", "isFeatured"], publicCreate: false,
    },
    categories: resource("categories", "Categories", [
      { field: "name", header: "Name" }, { field: "slug", header: "Slug" },
      { field: "description", header: "Description" }, { field: "sortOrder", header: "SortOrder", kind: "number" },
    ], z.object({ name: text(120).min(1), slug: text(140).min(1), description: text().optional(), sortOrder: z.number().int().default(0) }).passthrough(), ["id", "name", "slug", "description", "sortOrder"]),
    orders: resource("orders", "Orders", [
      { field: "orderNumber", header: "OrderNumber" }, { field: "status", header: "OrderStatus" },
      { field: "items", header: "Items", kind: "json" }, { field: "totalAmount", header: "TotalAmount", kind: "number" },
      { field: "deliveryFee", header: "DeliveryFee", kind: "number" }, { field: "shipping", header: "Shipping", kind: "json" },
      { field: "paymentMethod", header: "PaymentMethod" }, { field: "paymentStatus", header: "PaymentStatus" },
      { field: "note", header: "Note" },
      { field: "customerId", header: "CustomerID" }, { field: "customerName", header: "CustomerName" },
      { field: "customerPhone", header: "CustomerPhone" }, { field: "customerEmail", header: "CustomerEmail" },
    ], z.object({ orderNumber: text(100).min(1), status: z.enum(["new","confirmed","processing","shipped","delivered","cancelled"]), items: z.array(z.record(z.string(), z.unknown())).min(1).max(100),
      totalAmount: nonNegative, customerId: text(128).optional(), customerName: text(160).optional(),
      customerPhone: text(40).optional(), customerEmail: z.string().email().optional(), deliveryFee: nonNegative.optional(),
      shipping: z.object({ city: text(100).optional(), district: text(120).optional(), khoroo: text(120).optional(), detail: text(500).optional() }).optional(),
      paymentMethod: z.enum(["qpay", "bank", "cash"]).optional(), paymentStatus: z.enum(["pending", "paid", "failed", "refunded"]).default("pending"),
      note: text(2000).optional() }).passthrough(),
    ["id", "orderNumber", "status", "items", "totalAmount"], true),
    customers: resource("customers", "Customers", [
      { field: "name", header: "Name" }, { field: "phone", header: "Phone" }, { field: "email", header: "Email" },
    ], z.object({ name: text(160).min(1), phone: text(40).optional(), email: z.string().email().optional() }).passthrough(), ["id", "name"]),
    inventory: resource("inventory", "Inventory", [
      { field: "productId", header: "ProductID" }, { field: "changeAmount", header: "ChangeAmount", kind: "number" },
      { field: "reason", header: "Reason" }, { field: "balanceAfter", header: "BalanceAfter", kind: "number" },
    ], z.object({ productId: text(128).min(1), changeAmount: z.number().int(), reason: text(120).min(1), balanceAfter: z.number().int().min(0) }).passthrough(), ["id", "productId", "changeAmount", "reason", "balanceAfter"]),
    discounts: resource("discounts", "Discounts", [
      { field: "code", header: "Code" }, { field: "type", header: "Type" }, { field: "value", header: "Value", kind: "number" },
      { field: "minimumAmount", header: "MinimumAmount", kind: "number" }, { field: "startsAt", header: "StartsAt" }, { field: "endsAt", header: "EndsAt" }, { field: "isActive", header: "IsActive", kind: "boolean" },
    ], z.object({ code: z.string().trim().toUpperCase().regex(/^[A-Z0-9_-]{3,40}$/), type: z.enum(["percent","fixed"]), value: nonNegative,
      minimumAmount: nonNegative.default(0), startsAt: timestamp.optional(), endsAt: timestamp.optional(), isActive: z.boolean().default(true) }).passthrough(), []),
    settings: settings(),
  },
  restaurant: {
    menu: resource("menu", "Menu", [
      { field: "name", header: "Name" }, { field: "description", header: "Description" }, { field: "price", header: "Price", kind: "number" },
      { field: "isAvailable", header: "IsAvailable", kind: "boolean" }, { field: "categoryId", header: "CategoryID" },
      { field: "allergens", header: "Allergens", kind: "json" }, { field: "options", header: "Options", kind: "json" },
    ], z.object({ name: text(160).min(1), description: text().optional(), price: nonNegative, isAvailable: z.boolean().default(true),
      categoryId: text(128).nullable().optional(), allergens: z.array(text(80)).max(100).default([]), options: z.array(z.record(z.string(), z.unknown())).max(100).default([]) }).passthrough(),
    ["id", "name", "description", "price", "isAvailable", "categoryId", "allergens", "options"]),
    categories: resource("categories", "Categories", [
      { field: "name", header: "Name" }, { field: "description", header: "Description" }, { field: "sortOrder", header: "SortOrder", kind: "number" },
    ], z.object({ name: text(120).min(1), description: text().optional(), sortOrder: z.number().int().default(0) }).passthrough(), ["id", "name", "description", "sortOrder"]),
    orders: resource("orders", "Orders", [
      { field: "status", header: "OrderStatus" }, { field: "items", header: "Items", kind: "json" },
      { field: "totalAmount", header: "TotalAmount", kind: "number" }, { field: "customerName", header: "CustomerName" },
      { field: "customerPhone", header: "CustomerPhone" }, { field: "fulfillmentType", header: "FulfillmentType" },
      { field: "requestedAt", header: "RequestedAt" }, { field: "note", header: "Note" },
    ], z.object({ status: z.enum(["new","confirmed","processing","shipped","delivered","cancelled"]), items: z.array(z.record(z.string(), z.unknown())).min(1).max(100), totalAmount: nonNegative,
      customerName: text(160).optional(), customerPhone: text(40).optional(), fulfillmentType: text(40).optional(),
      requestedAt: timestamp.optional(), note: text().optional() }).passthrough(), ["id", "status", "items", "totalAmount"], true),
    reservations: resource("reservations", "Reservations", [
      { field: "customerName", header: "CustomerName" }, { field: "phone", header: "Phone" },
      { field: "partySize", header: "PartySize", kind: "number" }, { field: "reservedAt", header: "ReservedAt" },
      { field: "status", header: "Status" }, { field: "email", header: "Email" }, { field: "note", header: "Note" },
    ], z.object({ customerName: text(160).min(1), phone: text(40).min(6), partySize: positiveInt, reservedAt: timestamp,
      status: z.enum(["requested","confirmed","cancelled","completed"]).default("requested"), email: z.string().email().optional(), note: text().optional() }).passthrough(),
    ["id", "partySize", "reservedAt", "status"], true),
    openingHours: resource("openingHours", "OpeningHours", [
      { field: "weekday", header: "Weekday", kind: "number" }, { field: "opensAt", header: "OpensAt" },
      { field: "closesAt", header: "ClosesAt" }, { field: "isClosed", header: "IsClosed", kind: "boolean" },
      { field: "timezone", header: "Timezone" },
    ], z.object({ weekday: z.number().int().min(0).max(6), opensAt: text(5), closesAt: text(5), isClosed: z.boolean().default(false), timezone: text(80).default("Asia/Ulaanbaatar") }).passthrough(),
    ["id", "weekday", "opensAt", "closesAt", "isClosed"]),
    settings: settings(),
  },
  service_business: {
    services: resource("services", "Services", [
      { field: "name", header: "Name" }, { field: "description", header: "Description" },
      { field: "durationMinutes", header: "DurationMinutes", kind: "number" }, { field: "price", header: "Price", kind: "number" },
      { field: "currency", header: "Currency" }, { field: "isActive", header: "IsActive", kind: "boolean" },
    ], z.object({ name: text(160).min(1), description: text().optional(), durationMinutes: positiveInt, price: nonNegative.optional(), currency: text(3).optional(), isActive: z.boolean().default(true) }).passthrough(),
    ["id", "name", "description", "durationMinutes", "price", "currency"]),
    appointments: resource("appointments", "Appointments", [
      { field: "serviceId", header: "ServiceID" }, { field: "staffId", header: "StaffID" },
      { field: "customerName", header: "CustomerName" }, { field: "customerId", header: "CustomerID" },
      { field: "startsAt", header: "StartsAt" }, { field: "status", header: "Status" },
      { field: "phone", header: "Phone" }, { field: "email", header: "Email" }, { field: "note", header: "Note" },
    ], z.object({ serviceId: text(128).min(1), staffId: text(128).optional(), customerName: text(160).min(1),
      customerId: text(128).optional(), startsAt: timestamp, status: z.enum(["requested","confirmed","cancelled","completed"]).default("requested"), phone: text(40).optional(),
      email: z.string().email().optional(), note: text().optional() }).passthrough(), ["id", "serviceId", "startsAt", "status"], true),
    staff: resource("staff", "Staff", [
      { field: "name", header: "Name" }, { field: "email", header: "Email" }, { field: "phone", header: "Phone" },
      { field: "serviceIds", header: "ServiceIDs", kind: "json" }, { field: "availability", header: "Availability", kind: "json" },
      { field: "isActive", header: "IsActive", kind: "boolean" },
    ], z.object({ name: text(160).min(1), email: z.string().email().optional(), phone: text(40).optional(),
      serviceIds: z.array(text(128)).default([]), availability: z.array(z.record(z.string(), z.unknown())).default([]), isActive: z.boolean().default(true) }).passthrough(), ["id", "name", "isActive"]),
    customers: resource("customers", "Customers", [
      { field: "name", header: "Name" }, { field: "phone", header: "Phone" }, { field: "email", header: "Email" },
    ], z.object({ name: text(160).min(1), phone: text(40).optional(), email: z.string().email().optional() }).passthrough(), ["id", "name"]),
    availability: resource("availability", "Availability", [
      { field: "staffId", header: "StaffID" }, { field: "weekday", header: "Weekday", kind: "number" }, { field: "startsAt", header: "StartsAt" }, { field: "endsAt", header: "EndsAt" },
      { field: "timezone", header: "Timezone" }, { field: "isAvailable", header: "IsAvailable", kind: "boolean" },
    ], z.object({ staffId: text(128).min(1), weekday: z.number().int().min(0).max(6), startsAt: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/), endsAt: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/), timezone: z.string().default("Asia/Ulaanbaatar"), isAvailable: z.boolean().default(true) }).passthrough(), []),
    settings: settings(),
  },
  business_profile: {
    pages: resource("pages", "Pages", [
      { field: "slug", header: "Slug" }, { field: "title", header: "Title" }, { field: "body", header: "Body" },
      { field: "summary", header: "Summary" }, { field: "status", header: "Status" }, { field: "seo", header: "SEO", kind: "json" },
      { field: "sortOrder", header: "SortOrder", kind: "number" }, { field: "publishedAt", header: "PublishedAt" },
    ], z.object({ slug: text(180).min(1), title: text(240).min(1), body: text(50000), summary: text(1000).optional(),
      status: z.enum(["draft", "published"]), seo: z.record(z.string(), z.unknown()).optional(), sortOrder: z.number().int().default(0), publishedAt: timestamp.nullable().optional() }).passthrough(),
    ["id", "slug", "title", "body", "summary", "status", "seo", "sortOrder", "publishedAt"]),
    gallery: resource("gallery", "Gallery", [
      { field: "title", header: "Title" }, { field: "mediaUrl", header: "MediaURL" }, { field: "status", header: "Status" },
      { field: "alt", header: "Alt" }, { field: "caption", header: "Caption" }, { field: "category", header: "Category" },
      { field: "sortOrder", header: "SortOrder", kind: "number" },
    ], z.object({ title: text(240).min(1), mediaUrl: z.string().url(), status: z.enum(["draft", "published"]),
      alt: text(500).optional(), caption: text(2000).optional(), category: text(120).optional(), sortOrder: z.number().int().default(0) }).passthrough(),
    ["id", "title", "mediaUrl", "status", "alt", "caption", "category", "sortOrder"]),
    articles: resource("articles", "Articles", [
      { field: "slug", header: "Slug" }, { field: "title", header: "Title" }, { field: "body", header: "Body" },
      { field: "summary", header: "Summary" }, { field: "author", header: "Author" }, { field: "status", header: "Status" },
      { field: "publishedAt", header: "PublishedAt" }, { field: "seo", header: "SEO", kind: "json" },
    ], z.object({ slug: text(180).min(1), title: text(240).min(1), body: text(50000), summary: text(1000).optional(), author: text(160).optional(),
      status: z.enum(["draft", "published"]), publishedAt: timestamp.nullable().optional(), seo: z.record(z.string(), z.unknown()).optional() }).passthrough(),
    ["id", "slug", "title", "body", "summary", "author", "status", "publishedAt", "seo"]),
    contactInquiries: resource("contactInquiries", "ContactInquiries", [
      { field: "name", header: "Name" }, { field: "email", header: "Email" }, { field: "phone", header: "Phone" },
      { field: "subject", header: "Subject" }, { field: "message", header: "Message" }, { field: "status", header: "Status" },
    ], z.object({ name: text(160).min(1), email: z.string().email().optional(), phone: text(40).optional(), subject: text(240).optional(),
      message: text(5000).min(10), status: z.enum(["new","in_progress","resolved","spam"]).default("new") }).passthrough(), ["id", "status", "createdAt"], true),
    settings: settings(),
  },
  portfolio: {
    projects: resource("projects", "Projects", [
      { field: "title", header: "Title" }, { field: "slug", header: "Slug" }, { field: "description", header: "Description" }, { field: "body", header: "Body" },
      { field: "categoryId", header: "CategoryID" }, { field: "mediaUrl", header: "MediaURL" }, { field: "linkUrl", header: "LinkURL" }, { field: "status", header: "Status" }, { field: "sortOrder", header: "SortOrder", kind: "number" },
    ], z.object({ title: text(240).min(1), slug: text(180).min(1), description: text().optional(), body: text(50000).optional(), categoryId: text(128).nullable().optional(), mediaUrl: z.string().url().optional(), linkUrl: z.string().url().optional(), status: z.enum(["draft","published"]), sortOrder: z.number().int().default(0) }).passthrough(), ["id","title","slug","description","body","categoryId","mediaUrl","linkUrl","status","sortOrder"]),
    projectCategories: resource("projectCategories", "ProjectCategories", [ { field: "name", header: "Name" }, { field: "slug", header: "Slug" }, { field: "sortOrder", header: "SortOrder", kind: "number" } ],
      z.object({ name: text(160).min(1), slug: text(180).min(1), sortOrder: z.number().int().default(0) }).passthrough(), ["id","name","slug","sortOrder"]),
    gallery: resource("gallery", "Gallery", [ { field: "title", header: "Title" }, { field: "mediaUrl", header: "MediaURL" }, { field: "alt", header: "Alt" }, { field: "caption", header: "Caption" }, { field: "status", header: "Status" }, { field: "sortOrder", header: "SortOrder", kind: "number" } ],
      z.object({ title: text(240).min(1), mediaUrl: z.string().url(), alt: text(500).optional(), caption: text().optional(), status: z.enum(["draft","published"]), sortOrder: z.number().int().default(0) }).passthrough(), ["id","title","mediaUrl","alt","caption","status","sortOrder"]),
    settings: settings(),
  },
};

function resource(module: SheetModule, tab: string, fields: SheetField[], input: z.ZodObject<z.ZodRawShape>, publicFields: string[], publicCreate = false): ResourceSchema {
  return { module, tab, fields: [...common, ...fields], input, publicFields, publicCreate };
}

function settings(): ResourceSchema {
  return resource("settings", "Settings", [
    { field: "key", header: "Key" }, { field: "value", header: "Value", kind: "json" },
  ], z.object({ key: text(160).min(1), value: z.unknown() }).passthrough(), ["key", "value"]);
}

export function canonicalBusinessType(value: string): BusinessType {
  const normalized = value.trim().toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "_").replace(/^_+|_+$/g, "");
  if (["restaurant", "coffee", "cafe", "coffee_shop", "ресторан", "restaurant_coffee_shop", "ресторан_кофе_шоп"].includes(normalized)) return "restaurant";
  if (["service_business", "services", "үйлчилгээний_бизнес"].includes(normalized)) return "service_business";
  if (["business_profile", "profile", "бизнес_профайл"].includes(normalized)) return "business_profile";
  if (["portfolio", "портфолио"].includes(normalized)) return "portfolio";
  return "online_store"; // Legacy dashboard business-type labels are commerce categories.
}

export function modulesForBusiness(type: BusinessType): SheetModule[] {
  return Object.keys(schemas[type]) as SheetModule[];
}

export function schemaFor(type: BusinessType, module: string): ResourceSchema {
  const schema = schemas[type][module as SheetModule];
  if (!schema) throw new Error(`Resource '${module}' is not enabled for business type '${type}'.`);
  return schema;
}

export function resourceSchemas(type: BusinessType): ResourceSchema[] {
  return Object.values(schemas[type]).filter((entry): entry is ResourceSchema => Boolean(entry));
}
