import "server-only";
import { z } from "zod";
import type { StoreRecord } from "@/lib/registry";
import { canonicalBusinessType, schemaFor } from "@/lib/google/schema-registry";
import type { SheetResource } from "@/lib/google/types";
import { FIELD_LABELS, type FieldDescriptor } from "./modules";

export function schemaForSite(store: StoreRecord, module: string) {
  const schema = schemaFor(canonicalBusinessType(store.businessType), module);
  if (canonicalBusinessType(store.businessType) !== "online_store" || !["products", "categories", "orders", "customers", "inventory", "settings"].includes(module)) return schema;
  const resource = module as SheetResource;
  const mapping = store.sheets.columns?.[resource] ?? {};
  return { ...schema, tab: store.sheets.tabs?.[resource] || schema.tab, fields: schema.fields.map(field => ({ ...field, header: mapping[field.field === "status" && module === "orders" ? "orderStatus" : field.field] || field.header })) };
}

export function fieldsForSite(store: StoreRecord, module: string): FieldDescriptor[] {
  const schema = schemaForSite(store, module);
  return Object.entries(schema.input.shape).map(([key, raw]) => {
    const value = raw as z.ZodType;
    const field = schema.fields.find(f => f.field === key);
    const parsed = value.safeParse(undefined);
    let inner = value;
    while (inner instanceof z.ZodOptional || inner instanceof z.ZodNullable || inner instanceof z.ZodDefault) inner = inner._def.innerType as z.ZodType;
    const options = inner instanceof z.ZodEnum ? inner.options as string[] : undefined;
    const kind: FieldDescriptor["kind"] = options ? "select" : field?.kind === "json" ? "json" : field?.kind === "number" ? "number" : field?.kind === "boolean" ? "boolean" : ["reservedAt", "publishedAt", "requestedAt", ...(module !== "availability" ? ["startsAt", "endsAt"] : [])].includes(key) ? "datetime" : "text";
    return { key, label: FIELD_LABELS[key] ?? key, kind, required: !parsed.success, nullable: value.safeParse(null).success, options, defaultValue: parsed.success && parsed.data !== undefined ? parsed.data : kind === "json" ? inner instanceof z.ZodArray ? [] : {} : undefined };
  });
}
