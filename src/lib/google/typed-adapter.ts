import "server-only";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { RecordBase, SiteAdapter } from "./data-contracts";
import type { SheetBackend } from "./sheet-backend";
import type { ResourceSchema, SheetField } from "./schema-registry";

export class RecordConflictError extends Error { constructor() { super("Record changed since it was loaded."); this.name = "RecordConflictError"; } }
export class RecordNotFoundError extends Error { constructor() { super("Record was not found."); this.name = "RecordNotFoundError"; } }
export class RecordConfirmationError extends Error { constructor() { super("Explicit delete confirmation is required."); this.name = "RecordConfirmationError"; } }
export class IdempotencyConflictError extends Error { constructor() { super("This idempotency key was already used for different input."); this.name = "IdempotencyConflictError"; } }
export class SheetSchemaMismatchError extends Error { constructor(tab: string, missing: string[]) { super(`Sheet '${tab}' is missing required headers: ${missing.join(", ")}`); this.name = "SheetSchemaMismatchError"; } }

function jsonParse(value: string): unknown {
  if (!value) return null;
  try { return JSON.parse(value); } catch { return value; }
}

function fromCell(field: SheetField, value: string): unknown {
  if (!value) {
    if (field.kind === "number" || field.kind === "boolean") return undefined;
    if (field.kind === "json") {
      if (field.field === "extensions") return {};
      if (["images", "variants", "items", "allergens", "options", "serviceIds", "availability"].includes(field.field)) return [];
      return undefined;
    }
    if (["publishedAt", "requestedAt"].includes(field.field)) return undefined;
    return "";
  }
  if (field.kind === "json") return jsonParse(value);
  if (field.kind === "number") { const parsed = Number(value); return Number.isFinite(parsed) ? parsed : value; }
  if (field.kind === "boolean") return value.toLowerCase() === "true" || value === "1";
  return value;
}

function toCell(field: SheetField, value: unknown): string {
  if (value === undefined || value === null) return "";
  if (field.kind === "json" || (typeof value === "object" && value !== null)) return JSON.stringify(value);
  return String(value);
}

function requiredHeaders(schema: ResourceSchema): string[] {
  return schema.fields.map(field => field.header);
}

function parseRow(schema: ResourceSchema, row: { rowNumber: number; values: Record<string, string> }): RecordBase & Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const field of schema.fields) result[field.field] = fromCell(field, row.values[field.header] ?? "");
  result.deletedAt = result.deletedAt || null;
  result.idempotencyKey = result.idempotencyKey || undefined;
  if (typeof result.extensions === "string") result.extensions = jsonParse(result.extensions);
  return { ...result, extensions: (result.extensions as Record<string, unknown> | null) ?? {}, _rowNumber: row.rowNumber } as unknown as RecordBase & Record<string, unknown>;
}

function serialize(schema: ResourceSchema, record: Record<string, unknown>): Record<string, string> {
  const values: Record<string, string> = {};
  for (const field of schema.fields) values[field.header] = toCell(field, record[field.field]);
  values.Data = toCell({ field: "extensions", header: "Data", kind: "json" }, record.extensions ?? {});
  return values;
}

function normalizeForInput(schema: ResourceSchema, source: Record<string, unknown>): Record<string, unknown> {
  const normalized = { ...source };
  const shape = schema.input.shape;
  for (const [key, rawSchema] of Object.entries(shape)) {
    const fieldSchema = rawSchema as z.ZodType;
    const value = normalized[key];
    if (value === "" || value === undefined) {
      if (fieldSchema.safeParse(undefined).success) delete normalized[key];
      continue;
    }
    if (value === null && !fieldSchema.safeParse(null).success && fieldSchema.safeParse(undefined).success) delete normalized[key];
  }
  return normalized;
}

function assertHeaders(schema: ResourceSchema, headers: string[]) {
  const normalized = new Set(headers);
  const missing = requiredHeaders(schema).filter(header => !normalized.has(header));
  if (missing.length) throw new SheetSchemaMismatchError(schema.tab, missing);
}

export function createTypedSheetAdapter<T extends RecordBase>(backend: SheetBackend, schema: ResourceSchema): SiteAdapter<T> {
  async function table() {
    const table = await backend.readTable(schema.tab);
    assertHeaders(schema, table.headers);
    return { ...table, rows: table.rows.map(row => parseRow(schema, row)) };
  }
  async function byId(id: string) {
    const current = await table();
    return current.rows.find(row => row.id === id && !row.deletedAt) ?? null;
  }
  const baseInput = schema.input as z.ZodType<Record<string, unknown>>;

  return {
    async list() {
      const current = await table();
      return current.rows.filter(row => !row.deletedAt).map(({ _rowNumber: _private, ...row }) => row as unknown as T);
    },
    async get(id) {
      const row = await byId(id);
      if (!row) return null;
      const { _rowNumber: _private, ...publicRecord } = row;
      return publicRecord as unknown as T;
    },
    async create(input, idempotencyKey) {
      z.string().regex(/^[A-Za-z0-9._:-]{8,128}$/).parse(idempotencyKey);
      const validated = baseInput.parse(normalizeForInput(schema, input as Record<string, unknown>));
      const current = await table();
      const existing = current.rows.find(row => row.idempotencyKey === idempotencyKey);
      if (existing) {
        const keys = Object.keys(schema.input.shape);
        const persistedInput = normalizeForInput(schema, existing);
        const sameInput = keys.every(key => JSON.stringify(validated[key]) === JSON.stringify(persistedInput[key]));
        if (!sameInput) throw new IdempotencyConflictError();
        const { _rowNumber: _private, ...publicRecord } = existing;
        return publicRecord as unknown as T;
      }
      const now = new Date().toISOString();
      const record = { ...validated, id: randomUUID(), createdAt: now, updatedAt: now, deletedAt: "", idempotencyKey, extensions: validated.extensions ?? {} };
      await backend.writeRow(schema.tab, current.headers, serialize(schema, record));
      return { ...record, deletedAt: null } as unknown as T;
    },
    async update(id, expectedUpdatedAt, input) {
      const current = await table();
      const existing = current.rows.find(row => row.id === id && !row.deletedAt);
      if (!existing) throw new RecordNotFoundError();
      if (!expectedUpdatedAt || existing.updatedAt !== expectedUpdatedAt) throw new RecordConflictError();
      const inputRecord = input as Record<string, unknown>;
      if (["id", "createdAt", "deletedAt", "idempotencyKey"].some(key => Object.hasOwn(inputRecord, key))) {
        throw new Error("Protected record fields cannot be changed.");
      }
      const parsedPatch = schema.input.partial().parse(Object.fromEntries(Object.entries(inputRecord).map(([key, value]) => [key, value === "" && (schema.input.shape[key] as z.ZodType | undefined)?.safeParse(undefined).success ? undefined : value]))) as Record<string, unknown>;
      const patch = Object.fromEntries(Object.entries(parsedPatch).filter(([key]) => Object.hasOwn(inputRecord, key)));
      const merged = baseInput.parse(normalizeForInput(schema, { ...existing, ...patch, id, createdAt: existing.createdAt, updatedAt: new Date(Math.max(Date.now(), Date.parse(existing.updatedAt as string) + 1)).toISOString(), deletedAt: null }));
      const serialized = serialize(schema, merged as Record<string, unknown>);
      const changedHeaders = schema.fields.filter(field => Object.hasOwn(patch, field.field)).map(field => field.header);
      const writeHeaders = [...new Set([...changedHeaders, "UpdatedAt", ...(Object.hasOwn(patch, "extensions") ? ["Data"] : [])])];
      await backend.patchRow(schema.tab, current.headers, Object.fromEntries(writeHeaders.map(header => [header, serialized[header] ?? ""])), (existing as Record<string, unknown>)._rowNumber as number);
      const { _rowNumber: _private, ...publicRecord } = { ...existing, ...patch, ...merged };
      return publicRecord as unknown as T;
    },
    async delete(id, expectedUpdatedAt, confirmed) {
      if (confirmed !== true) throw new RecordConfirmationError();
      const current = await table();
      const existing = current.rows.find(row => row.id === id && !row.deletedAt);
      if (!existing) throw new RecordNotFoundError();
      if (!expectedUpdatedAt || existing.updatedAt !== expectedUpdatedAt) throw new RecordConflictError();
      const now = new Date().toISOString();
      const deletePatch: Record<string, string> = { DeletedAt: now, UpdatedAt: now };
      for (const [field, value] of [["isActive", "false"], ["isAvailable", "false"], ["status", "draft"]]) {
        const mapped = schema.fields.find(entry => entry.field === field);
        if (mapped && current.headers.includes(mapped.header)) deletePatch[mapped.header] = value;
      }
      await backend.patchRow(schema.tab, current.headers, deletePatch, (existing as Record<string, unknown>)._rowNumber as number);
    },
  };
}
