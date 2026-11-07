import "server-only";
import type { Grid, Cell } from "@/lib/backup/validation";
import { sheetApiFailure } from "@/lib/platform/telemetry";

import { createSign } from "node:crypto";
import {
  extractSpreadsheetId,
  type SheetResource,
} from "./types";

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const SHEETS_API = "https://sheets.googleapis.com/v4/spreadsheets";
const SCOPE = "https://www.googleapis.com/auth/spreadsheets";

interface ServiceAccount {
  clientEmail: string;
  privateKey: string;
  privateKeyId?: string;
}

interface CachedToken {
  accessToken: string;
  expiresAt: number;
}

const globalForGoogle = globalThis as unknown as {
  __axoraGoogleToken?: CachedToken;
};

export class GoogleSheetsError extends Error {
  readonly status: number;
  readonly code: string;
  readonly userMessage: string;

  constructor(
    message: string,
    options: { status?: number; code?: string; userMessage?: string } = {},
  ) {
    super(message);
    this.name = "GoogleSheetsError";
    this.status = options.status ?? 0;
    this.code = options.code ?? "google_sheets_error";
    this.userMessage =
      options.userMessage ??
      "Google Sheets-тэй холбогдож чадсангүй. Тохиргоо болон эрхийг шалгана уу.";
  }
}

function readServiceAccount(): ServiceAccount | null {
  const rawJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON?.trim();
  if (rawJson) {
    try {
      const json = rawJson.startsWith("{")
        ? rawJson
        : Buffer.from(rawJson, "base64").toString("utf8");
      const parsed = JSON.parse(json) as {
        client_email?: string;
        private_key?: string;
        private_key_id?: string;
      };
      if (parsed.client_email && parsed.private_key) {
        return {
          clientEmail: parsed.client_email,
          privateKey: parsed.private_key.replace(/\\n/g, "\n"),
          privateKeyId: parsed.private_key_id,
        };
      }
    } catch {
      // Fall through to individual variables.
    }
  }

  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL?.trim();
  const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n").trim();
  if (!clientEmail || !privateKey) return null;
  return {
    clientEmail,
    privateKey,
    privateKeyId: process.env.GOOGLE_PRIVATE_KEY_ID?.trim(),
  };
}

export function isGoogleCredentialsConfigured(): boolean {
  return Boolean(readServiceAccount());
}

function base64Url(input: string | Buffer): string {
  return Buffer.from(input)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function signJwt(account: ServiceAccount): string {
  const now = Math.floor(Date.now() / 1000);
  const header = {
    alg: "RS256",
    typ: "JWT",
    ...(account.privateKeyId ? { kid: account.privateKeyId } : {}),
  };
  const payload = {
    iss: account.clientEmail,
    scope: SCOPE,
    aud: TOKEN_URL,
    iat: now,
    exp: now + 3600,
  };
  const unsigned = `${base64Url(JSON.stringify(header))}.${base64Url(
    JSON.stringify(payload),
  )}`;
  const signer = createSign("RSA-SHA256");
  signer.update(unsigned);
  signer.end();
  const signature = signer.sign(account.privateKey);
  return `${unsigned}.${base64Url(signature)}`;
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs = 15000,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal, cache: "no-store" });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new GoogleSheetsError("Google Sheets request timed out", {
        code: "timeout",
        userMessage:
          "Google Sheets хариу өгөхгүй байна (timeout). Сүлжээ болон Sheets-ийн хэмжээг шалгана уу.",
      });
    }
    throw new GoogleSheetsError("Google Sheets network error", {
      code: "network",
      userMessage:
        "Google Sheets-тэй сүлжээгээр холбогдож чадсангүй. Дахин оролдоно уу.",
    });
  } finally {
    clearTimeout(timer);
  }
}

async function accessToken(): Promise<string> {
  const cached = globalForGoogle.__axoraGoogleToken;
  if (cached && cached.expiresAt > Date.now() + 60_000) {
    return cached.accessToken;
  }

  const account = readServiceAccount();
  if (!account) {
    throw new GoogleSheetsError("Google service account is not configured", {
      code: "not_configured",
      userMessage:
        "Google Sheets service account тохируулаагүй байна. GOOGLE_SERVICE_ACCOUNT_EMAIL болон GOOGLE_PRIVATE_KEY-г .env.local-д оруулна уу.",
    });
  }

  const assertion = signJwt(account);
  const response = await fetchWithTimeout(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });

  const text = await response.text();
  let payload: {
    access_token?: string;
    expires_in?: number;
    error?: string;
    error_description?: string;
  } = {};
  try {
    payload = JSON.parse(text);
  } catch {
    // Keep the raw text for diagnostics.
  }

  if (!response.ok || !payload.access_token) {
    throw new GoogleSheetsError(
      `Google token request failed: ${response.status} ${payload.error_description ?? text}`,
      {
        status: response.status,
        code: payload.error ?? "token_error",
        userMessage:
          "Google service account-ийн түлхүүр эсвэл эрх буруу байна. Credentials-ийг шалгана уу.",
      },
    );
  }

  const expiresIn = payload.expires_in ?? 3600;
  globalForGoogle.__axoraGoogleToken = {
    accessToken: payload.access_token,
    expiresAt: Date.now() + expiresIn * 1000,
  };
  return payload.access_token;
}

function userMessageForStatus(status: number, context: string): string {
  if (status === 401) {
    return "Google credentials хугацаа дууссан эсвэл буруу байна. Дахин шалгана уу.";
  }
  if (status === 403) {
    return "Service account-д энэ Spreadsheet-ийн эрх байхгүй байна. Spreadsheet-ийг service account-ийн имэйлтэй хуваалцана уу.";
  }
  if (status === 404) {
    return "Spreadsheet эсвэл Sheet tab олдсонгүй. ID болон tab-ийн нэрийг шалгана уу.";
  }
  if (status === 429) {
    return "Google Sheets API-ийн хязгаарт хүрлээ. Хэсэг хугацааны дараа дахин оролдоно уу.";
  }
  if (status >= 500) {
    return "Google Sheets сервер түр ажиллахгүй байна. Дахин оролдоно уу.";
  }
  return `${context} амжилтгүй боллоо. Google Sheets тохиргоог шалгана уу.`;
}

async function sheetsRequest<T>(
  path: string,
  init: RequestInit = {},
  context = "Google Sheets request",
): Promise<T> {
  let attempt = 0;
  let lastError: GoogleSheetsError | null = null;

  while (attempt < 3) {
    attempt += 1;
    const token = await accessToken();
    const response = await fetchWithTimeout(`${SHEETS_API}${path}`, {
      ...init,
      headers: {
        ...(init.headers ?? {}),
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

    const text = await response.text();
    let payload: unknown = null;
    try {
      payload = text ? JSON.parse(text) : null;
    } catch {
      payload = text;
    }

    if (response.ok) return payload as T;

    const message =
      typeof payload === "object" && payload !== null && "error" in payload
        ? String(
            (payload as { error?: { message?: string } }).error?.message ?? text,
          )
        : text;

    lastError = new GoogleSheetsError(
      `${context} failed (${response.status}): ${message}`,
      {
        status: response.status,
        code: `http_${response.status}`,
        userMessage: userMessageForStatus(response.status, context),
      },
    );

    if (response.status === 401) {
      globalForGoogle.__axoraGoogleToken = undefined;
    }

    const retryable = (!init.method || init.method === "GET" || init.method === "PUT") && (response.status === 429 || response.status >= 500);
    if (!retryable || attempt >= 3) break;
    await new Promise((resolve) => setTimeout(resolve, 350 * attempt * attempt));
  }

  await sheetApiFailure(lastError?.code??"google_api_failed");
  throw lastError ?? new GoogleSheetsError(context);
}

export interface SpreadsheetMeta {
  spreadsheetId: string;
  title: string;
  tabs: Array<{ title: string; sheetId: number; rowCount: number; columnCount: number }>;
}

export async function getSpreadsheetMeta(
  spreadsheetIdInput: string,
): Promise<SpreadsheetMeta> {
  const spreadsheetId = extractSpreadsheetId(spreadsheetIdInput);
  if (!spreadsheetId) {
    throw new GoogleSheetsError("Spreadsheet ID is empty", {
      code: "invalid_spreadsheet_id",
      userMessage: "Google Spreadsheet ID эсвэл URL оруулна уу.",
    });
  }

  const data = await sheetsRequest<{
    spreadsheetId: string;
    properties?: { title?: string };
    sheets?: Array<{
      properties?: {
        sheetId?: number;
        title?: string;
        gridProperties?: { rowCount?: number; columnCount?: number };
      };
    }>;
  }>(
    `/${encodeURIComponent(spreadsheetId)}?fields=spreadsheetId,properties.title,sheets.properties`,
    {},
    "Spreadsheet metadata",
  );

  return {
    spreadsheetId: data.spreadsheetId,
    title: data.properties?.title ?? "",
    tabs: (data.sheets ?? [])
      .map((sheet) => ({
        title: sheet.properties?.title ?? "",
        sheetId: sheet.properties?.sheetId ?? 0,
        rowCount: sheet.properties?.gridProperties?.rowCount ?? 0,
        columnCount: sheet.properties?.gridProperties?.columnCount ?? 0,
      }))
      .filter((tab) => tab.title),
  };
}

export interface SheetValues {
  range: string;
  majorDimension: string;
  values: unknown[][];
}

function quoteTab(tab: string): string {
  return `'${tab.replace(/'/g, "''")}'`;
}

export async function getSheetValues(
  spreadsheetIdInput: string,
  tab: string,
): Promise<SheetValues> {
  const spreadsheetId = extractSpreadsheetId(spreadsheetIdInput);
  const range = `${quoteTab(tab)}!A:ZZ`;
  return sheetsRequest<SheetValues>(
    `/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(
      range,
    )}?majorDimension=ROWS&valueRenderOption=UNFORMATTED_VALUE&dateTimeRenderOption=SERIAL_NUMBER`,
    {},
    `Reading sheet "${tab}"`,
  );
}

export async function updateSheetValues(
  spreadsheetIdInput: string,
  range: string,
  values: unknown[][],
): Promise<void> {
  const spreadsheetId = extractSpreadsheetId(spreadsheetIdInput);
  await sheetsRequest(
    `/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(
      range,
    )}?valueInputOption=RAW`,
    {
      method: "PUT",
      body: JSON.stringify({ range, majorDimension: "ROWS", values }),
    },
    `Writing sheet range "${range}"`,
  );
}

export async function appendSheetValues(
  spreadsheetIdInput: string,
  tab: string,
  values: unknown[][],
): Promise<void> {
  const spreadsheetId = extractSpreadsheetId(spreadsheetIdInput);
  const range = `${quoteTab(tab)}!A:ZZ`;
  await sheetsRequest(
    `/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(
      range,
    )}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
    {
      method: "POST",
      body: JSON.stringify({ range, majorDimension: "ROWS", values }),
    },
    `Appending sheet "${tab}"`,
  );
}

export async function batchUpdateSheet(
  spreadsheetIdInput: string,
  requests: unknown[],
): Promise<void> {
  const spreadsheetId = extractSpreadsheetId(spreadsheetIdInput);
  await sheetsRequest(
    `/${encodeURIComponent(spreadsheetId)}:batchUpdate`,
    {
      method: "POST",
      body: JSON.stringify({ requests }),
    },
    "Google Sheets batch update",
  );
}

export async function addSheetTab(
  spreadsheetIdInput: string,
  title: string,
): Promise<number> {
  const spreadsheetId = extractSpreadsheetId(spreadsheetIdInput);
  const result = await sheetsRequest<{
    replies?: Array<{ addSheet?: { properties?: { sheetId?: number } } }>;
  }>(
    `/${encodeURIComponent(spreadsheetId)}:batchUpdate`,
    {
      method: "POST",
      body: JSON.stringify({
        requests: [{ addSheet: { properties: { title } } }],
      }),
    },
    `Creating sheet "${title}"`,
  );
  return result.replies?.[0]?.addSheet?.properties?.sheetId ?? 0;
}

export async function deleteSheetRow(
  spreadsheetIdInput: string,
  sheetId: number,
  rowNumber: number,
): Promise<void> {
  await batchUpdateSheet(spreadsheetIdInput, [
    {
      deleteDimension: {
        range: {
          sheetId,
          dimension: "ROWS",
          startIndex: rowNumber - 1,
          endIndex: rowNumber,
        },
      },
    },
  ]);
}

export async function readSheetForResource(
  spreadsheetId: string,
  tab: string,
): Promise<SheetValues> {
  return getSheetValues(spreadsheetId, tab);
}

export function resourceTab(
  tabs: Record<SheetResource, string>,
  resource: SheetResource,
): string {
  return tabs[resource];
}

/** Preserve typed cell values and formulas for recovery; never replay append writes. */
export async function readWorkbookGrid(spreadsheetId:string):Promise<Grid> {
  const result=await sheetsRequest<{sheets:Array<{properties:{title:string};data?:Array<{startRow?:number;startColumn?:number;rowData?:Array<{values?:Array<{userEnteredValue?:Cell}>}>}>}>}>(`/${encodeURIComponent(spreadsheetId)}?includeGridData=true&fields=sheets(properties.title,data(startRow,startColumn,rowData.values.userEnteredValue))`,{},"Backup read");
  return result.sheets.map(s=>{
    const rows:Cell[][]=[];
    for(const block of s.data??[])for(const [i,row] of (block.rowData??[]).entries()){
      const index=(block.startRow??0)+i;rows[index]??=[];
      for(const [j,cell] of (row.values??[]).entries())rows[index][(block.startColumn??0)+j]=cell.userEnteredValue??{};
    }
    return {name:s.properties.title,rows:Array.from({length:rows.length},(_,i)=>Array.from({length:rows[i]?.length??0},(_,j)=>rows[i]?.[j]??{}))};
  });
}
export async function restoreWorkbookGrid(spreadsheetId:string,grid:Grid):Promise<void> {
  const meta=await getSpreadsheetMeta(spreadsheetId);
  const requests=grid.map(tab=>{
    const target=meta.tabs.find(t=>t.title===tab.name);if(!target)throw new Error("Restore tab is missing; repair mapping first.");
    const rows=Math.max(1,tab.rows.length),columns=Math.max(1,...tab.rows.map(r=>r.length));
    return [{updateSheetProperties:{properties:{sheetId:target.sheetId,gridProperties:{rowCount:Math.max(target.rowCount,rows),columnCount:Math.max(target.columnCount,columns)}},fields:"gridProperties.rowCount,gridProperties.columnCount"}},
      {updateCells:{range:{sheetId:target.sheetId},rows:tab.rows.map(r=>({values:r.map(v=>({userEnteredValue:v}))})),fields:"userEnteredValue"}}];
  }).flat();
  // One Google batchUpdate validates/applies the cell updates together.
  await batchUpdateSheet(spreadsheetId,requests);
}
