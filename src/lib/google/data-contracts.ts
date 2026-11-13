import { z } from "zod";

export type BusinessType = "online_store" | "restaurant" | "service_business" | "business_profile" | "portfolio";
export type SheetModule =
  | "products" | "categories" | "orders" | "customers" | "inventory" | "settings"
  | "menu" | "reservations" | "openingHours"
  | "services" | "appointments" | "staff"
  | "pages" | "gallery" | "articles" | "contactInquiries"
  | "discounts" | "availability" | "projects" | "projectCategories";

export interface RecordBase {
  id: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  idempotencyKey?: string;
  extensions?: Record<string, unknown>;
}

export interface ProductData extends RecordBase {
  name: string; slug: string; price: number; stock: number; isActive: boolean;
  categoryId: string | null; images: string[]; variants: Array<{ name: string; values: string[] }>;
}
export interface CategoryData extends RecordBase { name: string; slug: string; description?: string; sortOrder: number }
export interface OrderData extends RecordBase {
  orderNumber: string; status: string; items: Array<Record<string, unknown>>; totalAmount: number;
  customerId?: string; customerName?: string; customerPhone?: string; customerEmail?: string;
}
export interface CustomerData extends RecordBase { name: string; phone?: string; email?: string }
export interface MenuData extends RecordBase {
  name: string; price: number; isAvailable: boolean; categoryId: string | null;
  allergens: string[]; options: Array<Record<string, unknown>>;
}
export interface ReservationData extends RecordBase {
  customerName: string; phone: string; partySize: number; reservedAt: string; status: string;
}
export interface ServiceData extends RecordBase { name: string; durationMinutes: number; isActive: boolean; price?: number; currency?: string }
export interface AppointmentData extends RecordBase {
  serviceId: string; customerName: string; startsAt: string; status: string; staffId?: string;
}
export interface PageContentData extends RecordBase { slug: string; title: string; body: string; status: "draft" | "published" }
export interface GalleryData extends RecordBase { title: string; mediaUrl: string; status: "draft" | "published"; alt?: string; caption?: string }
export interface ContactInquiryData extends RecordBase { name: string; email?: string; message: string; status: string; subject?: string }

export interface SiteIntegrationConfig {
  site_id: string;
  business_type: BusinessType;
  spreadsheet_id: string;
  schema_version: number;
  enabled_modules: SheetModule[];
  integration_status: "unconfigured" | "provisioning" | "connected" | "error" | "local";
  last_successful_sync: string | null;
  configuration_version: number;
}

export interface SiteAdapter<T extends RecordBase> {
  list(): Promise<T[]>;
  get(id: string): Promise<T | null>;
  create(input: unknown, idempotencyKey: string): Promise<T>;
  update(id: string, expectedUpdatedAt: string, input: unknown): Promise<T>;
  delete(id: string, expectedUpdatedAt: string, confirmed: boolean): Promise<void>;
}

export const recordBaseSchema = z.object({
  id: z.string().uuid(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  deletedAt: z.string().datetime().nullable(),
  idempotencyKey: z.string().max(128).optional(),
  extensions: z.record(z.string(), z.unknown()).optional(),
});
