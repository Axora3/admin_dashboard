import "server-only";

import { promises as fs } from "node:fs";
import path from "node:path";
import {
  addSheetTab,
  appendSheetValues,
  deleteSheetRow,
  getSheetValues,
  getSpreadsheetMeta,
  updateSheetValues,
} from "./sheets-client";
import { tableFromValues, type SheetTable } from "./mapping";

export interface SheetBackend {
  readonly kind: "google" | "local";
  listTabs(): Promise<string[]>;
  readTable(tab: string): Promise<SheetTable>;
  writeRow(
    tab: string,
    headers: string[],
    values: Record<string, string>,
    rowNumber?: number | null,
  ): Promise<void>;
  deleteRow(tab: string, rowNumber: number): Promise<void>;
  ensureTable(tab: string, headers: string[]): Promise<void>;
}

export class SheetTabMissingError extends Error {
  readonly tab: string;
  constructor(tab: string) {
    super(`Sheet tab "${tab}" олдсонгүй.`);
    this.name = "SheetTabMissingError";
    this.tab = tab;
  }
}

function columnLetter(index: number): string {
  let result = "";
  let value = index + 1;
  while (value > 0) {
    const remainder = (value - 1) % 26;
    result = String.fromCharCode(65 + remainder) + result;
    value = Math.floor((value - 1) / 26);
  }
  return result;
}

function quoteTab(tab: string): string {
  return `'${tab.replace(/'/g, "''")}'`;
}

class GoogleSheetBackend implements SheetBackend {
  readonly kind = "google" as const;
  private tabIds: Map<string, number> | null = null;

  constructor(private readonly spreadsheetId: string) {}

  private async tabMap(): Promise<Map<string, number>> {
    if (this.tabIds) return this.tabIds;
    const meta = await getSpreadsheetMeta(this.spreadsheetId);
    this.tabIds = new Map(meta.tabs.map((tab) => [tab.title, tab.sheetId]));
    return this.tabIds;
  }

  async listTabs(): Promise<string[]> {
    return Array.from((await this.tabMap()).keys());
  }

  async readTable(tab: string): Promise<SheetTable> {
    const tabs = await this.tabMap();
    if (!tabs.has(tab)) throw new SheetTabMissingError(tab);
    try {
      const values = await getSheetValues(this.spreadsheetId, tab);
      return tableFromValues(values.values ?? []);
    } catch (error) {
      if (
        error instanceof Error &&
        /unable to parse range|not found|404/i.test(error.message)
      ) {
        throw new SheetTabMissingError(tab);
      }
      throw error;
    }
  }

  async writeRow(
    tab: string,
    headers: string[],
    values: Record<string, string>,
    rowNumber?: number | null,
  ): Promise<void> {
    const row = headers.map((header) => values[header] ?? "");
    const lastColumn = columnLetter(Math.max(headers.length - 1, 0));
    if (rowNumber && rowNumber >= 2) {
      await updateSheetValues(
        this.spreadsheetId,
        `${quoteTab(tab)}!A${rowNumber}:${lastColumn}${rowNumber}`,
        [row],
      );
      return;
    }
    await appendSheetValues(this.spreadsheetId, tab, [row]);
  }

  async deleteRow(tab: string, rowNumber: number): Promise<void> {
    const tabs = await this.tabMap();
    const sheetId = tabs.get(tab);
    if (sheetId === undefined) throw new SheetTabMissingError(tab);
    await deleteSheetRow(this.spreadsheetId, sheetId, rowNumber);
  }

  async ensureTable(tab: string, headers: string[]): Promise<void> {
    const tabs = await this.tabMap();
    if (!tabs.has(tab)) {
      const sheetId = await addSheetTab(this.spreadsheetId, tab);
      this.tabIds?.set(tab, sheetId);
    }
    const table = await this.readTable(tab);
    if (table.headers.length === 0 && headers.length > 0) {
      await updateSheetValues(
        this.spreadsheetId,
        `${quoteTab(tab)}!A1:${columnLetter(headers.length - 1)}1`,
        [headers],
      );
    }
  }
}

interface LocalTab {
  headers: string[];
  rows: Array<Record<string, string>>;
}

interface LocalWorkbook {
  version: 1;
  tabs: Record<string, LocalTab>;
}

const globalForLocal = globalThis as unknown as {
  __axoraLocalSheetLocks?: Map<string, Promise<void>>;
};

function lockFor(file: string): Promise<void> {
  if (!globalForLocal.__axoraLocalSheetLocks) {
    globalForLocal.__axoraLocalSheetLocks = new Map();
  }
  return globalForLocal.__axoraLocalSheetLocks.get(file) ?? Promise.resolve();
}

async function withFileLock<T>(file: string, action: () => Promise<T>): Promise<T> {
  const previous = lockFor(file);
  const locks = globalForLocal.__axoraLocalSheetLocks!;
  let release!: () => void;
  const current = new Promise<void>((resolve) => {
    release = resolve;
  });
  locks.set(file, previous.then(() => current));
  await previous;
  try {
    return await action();
  } finally {
    release();
    if (locks.get(file) === current) locks.delete(file);
  }
}

function localRoot(): string {
  return process.env.AXORA_DATA_DIR
    ? path.resolve(process.env.AXORA_DATA_DIR)
    : path.join(process.cwd(), ".data");
}

function localFile(storeId: string): string {
  const safe = storeId.replace(/[^a-zA-Z0-9_-]/g, "_");
  return path.join(localRoot(), "sheets", `${safe}.json`);
}

async function readWorkbook(file: string): Promise<LocalWorkbook> {
  try {
    const raw = await fs.readFile(file, "utf8");
    const parsed = JSON.parse(raw) as LocalWorkbook;
    if (!parsed || typeof parsed !== "object" || !parsed.tabs) {
      return { version: 1, tabs: {} };
    }
    return parsed;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return { version: 1, tabs: {} };
    }
    throw error;
  }
}

async function writeWorkbook(file: string, workbook: LocalWorkbook): Promise<void> {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const temp = `${file}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(temp, JSON.stringify(workbook, null, 2), "utf8");
  await fs.rename(temp, file);
}

class LocalSheetBackend implements SheetBackend {
  readonly kind = "local" as const;
  private readonly file: string;

  constructor(storeId: string) {
    this.file = localFile(storeId);
  }

  async listTabs(): Promise<string[]> {
    return Object.keys((await readWorkbook(this.file)).tabs);
  }

  async readTable(tab: string): Promise<SheetTable> {
    const workbook = await readWorkbook(this.file);
    const table = workbook.tabs[tab];
    if (!table) throw new SheetTabMissingError(tab);
    return {
      headers: table.headers,
      rows: table.rows.map((row, index) => ({
        rowNumber: index + 2,
        values: { ...row },
      })),
    };
  }

  async writeRow(
    tab: string,
    headers: string[],
    values: Record<string, string>,
    rowNumber?: number | null,
  ): Promise<void> {
    await withFileLock(this.file, async () => {
      const workbook = await readWorkbook(this.file);
      const table = workbook.tabs[tab] ?? { headers: [...headers], rows: [] };
      if (table.headers.length === 0) table.headers = [...headers];
      const record: Record<string, string> = {};
      for (const header of table.headers) record[header] = values[header] ?? "";
      if (rowNumber && rowNumber >= 2) {
        const index = rowNumber - 2;
        if (index >= 0 && index < table.rows.length) {
          table.rows[index] = record;
        } else {
          table.rows.push(record);
        }
      } else {
        table.rows.push(record);
      }
      workbook.tabs[tab] = table;
      await writeWorkbook(this.file, workbook);
    });
  }

  async deleteRow(tab: string, rowNumber: number): Promise<void> {
    await withFileLock(this.file, async () => {
      const workbook = await readWorkbook(this.file);
      const table = workbook.tabs[tab];
      if (!table) throw new SheetTabMissingError(tab);
      const index = rowNumber - 2;
      if (index >= 0 && index < table.rows.length) {
        table.rows.splice(index, 1);
        await writeWorkbook(this.file, workbook);
      }
    });
  }

  async ensureTable(tab: string, headers: string[]): Promise<void> {
    await withFileLock(this.file, async () => {
      const workbook = await readWorkbook(this.file);
      const existing = workbook.tabs[tab];
      if (!existing) {
        workbook.tabs[tab] = { headers: [...headers], rows: [] };
      } else if (existing.headers.length === 0) {
        existing.headers = [...headers];
      }
      await writeWorkbook(this.file, workbook);
    });
  }
}

export function createSheetBackend(input: {
  storeId: string;
  spreadsheetId: string;
  mode: "google" | "local";
}): SheetBackend {
  if (input.mode === "google") {
    return new GoogleSheetBackend(input.spreadsheetId);
  }
  return new LocalSheetBackend(input.storeId);
}

export async function localWorkbookExists(storeId: string): Promise<boolean> {
  try {
    await fs.access(localFile(storeId));
    return true;
  } catch {
    return false;
  }
}

export async function clearLocalWorkbook(storeId: string): Promise<void> {
  await fs.rm(localFile(storeId), { force: true });
}

export async function clearAllLocalData(): Promise<void> {
  await fs.rm(path.join(localRoot(), "sheets"), { recursive: true, force: true });
  await fs.rm(path.join(localRoot(), "registry.json"), { force: true });
  await fs.rm(path.join(localRoot(), "audit-logs.json"), { force: true });
}
