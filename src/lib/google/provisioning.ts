import "server-only";
import { createSheetBackend } from "./sheet-backend";
import { addSheetTab, createSpreadsheetIdempotent, deleteSheetTab, getSheetValues, getSpreadsheetMeta, updateSheetValues } from "./sheets-client";
import { resourceSchemas, SHEET_SCHEMA_VERSION, canonicalBusinessType } from "./schema-registry";
import type { BusinessType } from "./data-contracts";

/** Create or resume one workbook, provision the business-specific schema, then verify it. */
export async function provisionSiteSpreadsheet(input: {
  storeId: string;
  storeName: string;
  businessType: string;
  idempotencyKey: string;
}) {
  const businessType = canonicalBusinessType(input.businessType) as BusinessType;
  const workbook = await createSpreadsheetIdempotent({
    idempotencyKey: input.idempotencyKey,
    title: `${input.storeName} — AXORA data`,
  });

  const backend = createSheetBackend({ storeId: input.storeId, spreadsheetId: workbook.spreadsheetId, mode: "google" });
  const required = resourceSchemas(businessType);
  for (const schema of required) {
    await backend.ensureTable(schema.tab, schema.fields.map(field => field.header));
    await backend.ensureColumns(schema.tab, schema.fields.map(field => field.header));
  }

  const meta = await getSpreadsheetMeta(workbook.spreadsheetId);
  const tabs = new Set(meta.tabs.map(tab => tab.title));
  for (const schema of required) {
    if (!tabs.has(schema.tab)) throw new Error(`Provisioning verification failed: missing ${schema.tab} tab.`);
    const values = await getSheetValues(workbook.spreadsheetId, schema.tab);
    const headers = (values.values?.[0] ?? []).map(value => String(value).trim());
    const missing = schema.fields.map(field => field.header).filter(header => !headers.includes(header));
    if (missing.length) throw new Error(`Provisioning verification failed: ${schema.tab} is missing required columns.`);
  }

  // Verify write permission with a temporary tab, then remove it. This never writes a probe into customer data.
  const probeTab = `__AXORA_PROBE_${input.storeId.replace(/[^a-zA-Z0-9]/g, "").slice(0, 12)}__`;
  const probeId = crypto.randomUUID();
  let probeSheetId: number | null = null;
  try {
    probeSheetId = await addSheetTab(workbook.spreadsheetId, probeTab);
    await updateSheetValues(workbook.spreadsheetId, `'${probeTab}'!A1`, [[probeId]]);
    const probe = await getSheetValues(workbook.spreadsheetId, probeTab);
    if (String(probe.values?.[0]?.[0] ?? "") !== probeId) throw new Error("Provisioning read/write verification failed.");
  } finally {
    if (probeSheetId !== null) await deleteSheetTab(workbook.spreadsheetId, probeSheetId);
  }

  return {
    spreadsheetId: workbook.spreadsheetId,
    spreadsheetName: workbook.title,
    schemaVersion: SHEET_SCHEMA_VERSION,
    businessType,
    enabledModules: required.map(schema => schema.module),
  };
}
