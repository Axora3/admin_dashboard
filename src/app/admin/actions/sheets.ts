"use server";

import { requireSuperAdmin } from "@/lib/auth/server";
import { sheetsMode } from "@/lib/config";
import { messageOf } from "@/lib/errors";
import {
  autoMapColumns,
  requiredMissing,
  tableFromValues,
} from "@/lib/google/mapping";
import {
  getSheetValues,
  getSpreadsheetMeta,
  GoogleSheetsError,
} from "@/lib/google/sheets-client";
import {
  DEFAULT_COLUMNS,
  DEFAULT_TABS,
  REQUIRED_COLUMNS,
  cloneColumns,
  extractSpreadsheetId,
  type SheetResource,
  type StoreSheetColumns,
  type StoreSheetTabs,
} from "@/lib/google/types";

export interface SheetInspectInput {
  spreadsheetUrl: string;
  tabs: Partial<StoreSheetTabs>;
  columns?: Partial<StoreSheetColumns>;
}

export interface SheetInspectTab {
  tab: string;
  exists: boolean;
  headers: string[];
  sampleRows: Array<Record<string, string>>;
  rowCount: number;
  missingRequired: string[];
  error: string | null;
}

export interface SheetInspectResult {
  ok: boolean;
  mode: "google" | "local";
  message?: string;
  spreadsheetId?: string;
  spreadsheetName?: string | null;
  tabs?: string[];
  inspected?: Record<SheetResource, SheetInspectTab>;
  suggestedColumns?: StoreSheetColumns;
}

const RESOURCES: SheetResource[] = [
  "products",
  "categories",
  "orders",
  "customers",
  "settings",
  "inventory",
];

function emptyTab(tab: string, error: string | null): SheetInspectTab {
  return {
    tab,
    exists: false,
    headers: [],
    sampleRows: [],
    rowCount: 0,
    missingRequired: [],
    error,
  };
}

/**
 * Reads a store spreadsheet's metadata, tabs, headers and sample rows so the
 * admin can verify the connection and column mapping before saving.
 *
 * Server-side only. Credentials and the resolved spreadsheet ID never reach
 * the browser beyond what the admin already entered in the form.
 */
export async function inspectSheetsAction(
  input: SheetInspectInput,
): Promise<SheetInspectResult> {
  await requireSuperAdmin();
  const mode = sheetsMode();
  const tabs = { ...DEFAULT_TABS, ...(input.tabs ?? {}) };
  const columns = cloneColumns({ ...DEFAULT_COLUMNS, ...(input.columns ?? {}) });
  const spreadsheetId = extractSpreadsheetId(input.spreadsheetUrl ?? "");

  if (mode === "local") {
    return {
      ok: false,
      mode,
      message:
        "Локал горим идэвхтэй байна. Google Sheets холболтыг шалгахын тулд GOOGLE_SERVICE_ACCOUNT_EMAIL болон GOOGLE_PRIVATE_KEY-г .env.local-д тохируулна уу. Локал горимд дэлгүүр бүрийн өгөгдөл .data/sheets/<storeId>.json файлд хадгалагдана.",
    };
  }

  if (!spreadsheetId) {
    return {
      ok: false,
      mode,
      message: "Google Spreadsheet URL эсвэл ID оруулна уу.",
    };
  }

  let meta;
  try {
    meta = await getSpreadsheetMeta(spreadsheetId);
  } catch (error) {
    return {
      ok: false,
      mode,
      message: messageOf(error),
    };
  }

  const tabNames = meta.tabs.map((tab) => tab.title);
  const inspected = {} as Record<SheetResource, SheetInspectTab>;
  const suggestedColumns = cloneColumns(columns);

  for (const resource of RESOURCES) {
    const tab = tabs[resource];
    const mapping = columns[resource] ?? DEFAULT_COLUMNS[resource];
    if (!tabNames.includes(tab)) {
      inspected[resource] = {
        ...emptyTab(tab, `"${tab}" tab энэ Spreadsheet-д олдсонгүй.`),
        missingRequired: REQUIRED_COLUMNS[resource].map(
          (field) => DEFAULT_COLUMNS[resource][field],
        ),
      };
      continue;
    }

    try {
      const values = await getSheetValues(spreadsheetId, tab);
      const table = tableFromValues(values.values ?? []);
      const missing = requiredMissing(table.headers, mapping, resource);
      suggestedColumns[resource] = autoMapColumns(
        table.headers,
        resource,
        mapping,
      );
      inspected[resource] = {
        tab,
        exists: true,
        headers: table.headers,
        sampleRows: table.rows.slice(0, 5).map((row) => row.values),
        rowCount: table.rows.length,
        missingRequired: missing.map(
          (field) => DEFAULT_COLUMNS[resource][field],
        ),
        error: null,
      };
    } catch (error) {
      inspected[resource] = emptyTab(
        tab,
        error instanceof GoogleSheetsError
          ? error.userMessage
          : messageOf(error),
      );
    }
  }

  return {
    ok: true,
    mode,
    spreadsheetId,
    spreadsheetName: meta.title || null,
    tabs: tabNames,
    inspected,
    suggestedColumns,
  };
}
