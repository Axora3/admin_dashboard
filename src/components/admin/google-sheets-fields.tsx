"use client";

import { useMemo, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  RefreshCw,
  Sheet as SheetIcon,
  Table2,
} from "lucide-react";
import type {
  SheetInspectResult,
  SheetInspectTab,
} from "@/app/admin/actions/sheets";
import { inspectSheetsAction } from "@/app/admin/actions/sheets";
import type { StoreSheetsMeta } from "@/lib/types";
import {
  DEFAULT_COLUMNS,
  DEFAULT_TABS,
  RESOURCE_LABELS,
  cloneColumns,
  type SheetResource,
  type StoreSheetColumns,
  type StoreSheetTabs,
} from "@/lib/google/types";
import { Alert } from "@/components/admin/alert";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

const RESOURCES: SheetResource[] = [
  "products",
  "categories",
  "orders",
  "customers",
  "settings",
  "inventory",
];

function statusBadge(status: StoreSheetsMeta["connectionStatus"]) {
  if (status === "connected") {
    return <Badge tone="success" dot>Google Sheets холбогдсон</Badge>;
  }
  if (status === "local") {
    return <Badge tone="warning" dot>Локал эмулятор</Badge>;
  }
  if (status === "error") {
    return <Badge tone="danger" dot>Холболтын алдаа</Badge>;
  }
  return <Badge tone="neutral">Тохируулаагүй</Badge>;
}

function InspectedResource({
  resource,
  inspected,
  columns,
  onColumnChange,
}: {
  resource: SheetResource;
  inspected: SheetInspectTab;
  columns: StoreSheetColumns;
  onColumnChange: (
    resource: SheetResource,
    field: string,
    header: string,
  ) => void;
}) {
  const defaults = DEFAULT_COLUMNS[resource];
  const mapping = columns[resource];
  const headerOptions = inspected.headers;

  return (
    <div className="rounded-xl border border-ink-100 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-ink-100 px-3.5 py-2.5">
        <div className="flex items-center gap-2">
          <span className="text-[13px] font-semibold text-ink-900">
            {RESOURCE_LABELS[resource]}
          </span>
          <span className="rounded-md bg-surface-muted px-1.5 py-0.5 font-mono text-2xs text-ink-500">
            {inspected.tab}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          {inspected.exists ? (
            <Badge tone="success" dot>
              {inspected.rowCount} мөр
            </Badge>
          ) : (
            <Badge tone="danger" dot>
              Tab олдсонгүй
            </Badge>
          )}
        </div>
      </div>

      <div className="space-y-3 px-3.5 py-3">
        {inspected.error ? (
          <p className="text-xs leading-relaxed text-danger-700">
            {inspected.error}
          </p>
        ) : null}

        {inspected.exists && inspected.missingRequired.length > 0 ? (
          <div className="rounded-lg border border-warning-100 bg-warning-50/70 px-3 py-2 text-xs leading-relaxed text-warning-700">
            <b>Заавал шаардлагатай багана дутуу:</b>{" "}
            {inspected.missingRequired.join(", ")}. Доорх mapping-оор тохируулах
            эсвэл sheet-д эдгээр баганыг нэмнэ үү.
          </div>
        ) : null}

        {inspected.exists ? (
          <>
            <div>
              <p className="mb-1 text-2xs font-medium uppercase tracking-wide text-ink-400">
                Илэрсэн баганууд
              </p>
              <div className="flex flex-wrap gap-1">
                {inspected.headers.length === 0 ? (
                  <span className="text-xs text-ink-400">
                    Header мөр хоосон байна.
                  </span>
                ) : (
                  inspected.headers.map((header) => (
                    <span
                      key={header}
                      className="rounded-md bg-surface-muted px-1.5 py-0.5 font-mono text-2xs text-ink-600"
                    >
                      {header}
                    </span>
                  ))
                )}
              </div>
            </div>

            {inspected.sampleRows.length > 0 ? (
              <div className="overflow-hidden rounded-lg border border-ink-100">
                <div className="axora-scroll">
                  <table className="axora-table min-w-[520px] text-2xs">
                    <thead>
                      <tr>
                        {inspected.headers.slice(0, 8).map((header) => (
                          <th key={header}>{header}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {inspected.sampleRows.slice(0, 3).map((row, index) => (
                        <tr key={index}>
                          {inspected.headers.slice(0, 8).map((header) => (
                            <td
                              key={header}
                              className="max-w-[160px] truncate text-ink-600"
                            >
                              {row[header] || "—"}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null}

            <details className="rounded-lg border border-ink-100 bg-surface-muted/40 px-3 py-2">
              <summary className="cursor-pointer text-xs font-medium text-ink-700">
                Column mapping тохируулах ({Object.keys(defaults).length} талбар)
              </summary>
              <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {Object.entries(defaults).map(([field, defaultHeader]) => (
                  <label key={field} className="block min-w-0">
                    <span className="mb-1 block truncate text-2xs font-medium text-ink-500">
                      {defaultHeader}
                    </span>
                    <Select
                      value={mapping[field] ?? ""}
                      onChange={(event) =>
                        onColumnChange(resource, field, event.target.value)
                      }
                      className="h-8 text-xs"
                    >
                      <option value="">Auto ({defaultHeader})</option>
                      {headerOptions.map((header) => (
                        <option key={header} value={header}>
                          {header}
                        </option>
                      ))}
                    </Select>
                  </label>
                ))}
              </div>
            </details>
          </>
        ) : null}
      </div>
    </div>
  );
}

export function GoogleSheetsFields({
  initial,
  errors,
}: {
  initial?: {
    connectionStatus: StoreSheetsMeta["connectionStatus"];
    spreadsheetName: string | null;
    lastError: string | null;
    tabs?: Partial<StoreSheetTabs>;
    columns?: Partial<StoreSheetColumns>;
  };
  errors?: Record<string, string>;
}) {
  const [url, setUrl] = useState("");
  const [tabs, setTabs] = useState<StoreSheetTabs>({
    ...DEFAULT_TABS,
    ...(initial?.tabs ?? {}),
  });
  const [columns, setColumns] = useState<StoreSheetColumns>(() =>
    cloneColumns({ ...DEFAULT_COLUMNS, ...(initial?.columns ?? {}) }),
  );
  const [result, setResult] = useState<SheetInspectResult | null>(null);
  const [pending, setPending] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const tabsJson = useMemo(() => JSON.stringify(tabs), [tabs]);
  const columnsJson = useMemo(() => JSON.stringify(columns), [columns]);

  async function inspect() {
    setPending(true);
    setLocalError(null);
    try {
      const response = await inspectSheetsAction({
        spreadsheetUrl: url,
        tabs,
        columns,
      });
      setResult(response);
      if (response.suggestedColumns) {
        setColumns(response.suggestedColumns);
      }
      if (!response.ok && response.message) {
        setLocalError(response.message);
      }
    } catch (error) {
      setLocalError(
        error instanceof Error ? error.message : "Холболт шалгахад алдаа гарлаа.",
      );
    } finally {
      setPending(false);
    }
  }

  function changeTab(resource: SheetResource, value: string) {
    setTabs((current) => ({ ...current, [resource]: value }));
  }

  function changeColumn(
    resource: SheetResource,
    field: string,
    header: string,
  ) {
    setColumns((current) => ({
      ...current,
      [resource]: { ...current[resource], [field]: header },
    }));
  }

  const hasSpreadsheet = Boolean(url.trim());
  const status = result?.ok
    ? "connected"
    : initial?.connectionStatus ?? "unconfigured";

  return (
    <section className="rounded-2xl border border-ink-100 bg-white shadow-card">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-ink-100 px-5 py-4">
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-success-50 text-success-600">
            <SheetIcon className="h-4 w-4" />
          </span>
          <div>
            <h2 className="text-[15px] font-semibold text-ink-900">
              Google Sheets холболт
            </h2>
            <p className="mt-0.5 text-xs text-ink-500">
              Дэлгүүрийн бүтээгдэхүүн, ангилал, захиалга, харилцагч, тохиргоо
              энэ Spreadsheet-д хадгалагдана.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {statusBadge(status)}
          {initial?.spreadsheetName ? (
            <Badge tone="neutral">{initial.spreadsheetName}</Badge>
          ) : null}
        </div>
      </div>

      <div className="space-y-4 px-5 py-5">
        <input type="hidden" name="spreadsheetUrl" value={url} />
        <input type="hidden" name="sheetTabs" value={tabsJson} />
        <input type="hidden" name="sheetColumns" value={columnsJson} />

        {initial?.lastError ? (
          <Alert variant="danger" title="Сүүлийн холболтын алдаа">
            {initial.lastError}
          </Alert>
        ) : null}

        <Field
          label="Google Spreadsheet URL эсвэл ID"
          htmlFor="spreadsheetUrl"
          hint={
            initial?.connectionStatus === "connected"
              ? "Одоогийн Spreadsheet ID-г аюулгүй байдлын үүднээс харуулахгүй. Холболтыг өөрчлөх бол шинэ URL оруулна уу."
              : "Жишээ: https://docs.google.com/spreadsheets/d/…/edit эсвэл Spreadsheet ID."
          }
          error={errors?.spreadsheetUrl}
          className="sm:col-span-2"
        >
          <Input
            id="spreadsheetUrl"
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            placeholder="https://docs.google.com/spreadsheets/d/…/edit"
            autoComplete="off"
            spellCheck={false}
          />
        </Field>

        <div>
          <p className="mb-2 text-2xs font-medium uppercase tracking-wide text-ink-400">
            Sheet tab нэрс
          </p>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {RESOURCES.map((resource) => (
              <label key={resource} className="block min-w-0">
                <span className="mb-1 block text-2xs font-medium text-ink-500">
                  {RESOURCE_LABELS[resource]}
                </span>
                <Input
                  value={tabs[resource]}
                  onChange={(event) => changeTab(resource, event.target.value)}
                  className="h-8 font-mono text-xs"
                  spellCheck={false}
                />
              </label>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="secondary"
            size="md"
            onClick={inspect}
            disabled={pending || !hasSpreadsheet}
          >
            {pending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            Холболт шалгах
          </Button>
          <p className="text-2xs text-ink-400">
            Tab, header болон эхний мөрүүдийг уншиж шалгана. Service account-д
            Spreadsheet-ийн <b>Editor</b> эрх байх ёстой.
          </p>
        </div>

        {localError ? <Alert variant="danger">{localError}</Alert> : null}

        {result?.ok ? (
          <Alert variant="success" title="Холболт амжилттай">
            <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span>
                Spreadsheet: <b>{result.spreadsheetName || "—"}</b>
              </span>
              <span>· {result.tabs?.length ?? 0} tab</span>
              <span>· {result.spreadsheetId}</span>
            </span>
          </Alert>
        ) : null}

        {result?.inspected ? (
          <div className="space-y-2.5">
            {RESOURCES.map((resource) => (
              <InspectedResource
                key={resource}
                resource={resource}
                inspected={result.inspected![resource]}
                columns={columns}
                onColumnChange={changeColumn}
              />
            ))}
          </div>
        ) : null}

        {result?.ok ? (
          <div className="flex items-center gap-2 rounded-xl bg-surface-muted/70 px-3 py-2.5 text-2xs leading-relaxed text-ink-500">
            <Table2 className="h-3.5 w-3.5 shrink-0 text-ink-400" />
            Табууд байхгүй бол хадгалах үед автоматаар үүсгэгдэнэ. Одоо байгаа
            sheet-ийн нэмэлт баганууд хадгалагдана.
          </div>
        ) : null}

        {!result && initial?.connectionStatus === "connected" ? (
          <p className="flex items-center gap-1.5 text-2xs text-success-700">
            <CheckCircle2 className="h-3.5 w-3.5" /> Энэ дэлгүүр Google
            Sheets-тэй холбогдсон байна.
          </p>
        ) : null}
        {!result && initial?.connectionStatus === "error" ? (
          <p className="flex items-center gap-1.5 text-2xs text-danger-700">
            <AlertCircle className="h-3.5 w-3.5" /> Холболт шалгах товчоор
            алдааг дахин шалгана уу.
          </p>
        ) : null}
      </div>
    </section>
  );
}
