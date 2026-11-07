import "server-only";

import { promises as fs } from "node:fs";
import path from "node:path";
import type { AuditFilters, AuditLog, Paginated } from "@/lib/types";
import type { AuditInput } from "@/lib/data/repository";
import { paginate, randomToken } from "@/lib/utils";

interface AuditFile {
  version: 1;
  logs: AuditLog[];
}

const globalForAudit = globalThis as unknown as {
  __axoraAuditLock?: Promise<void>;
};

function dataDir(): string {
  return process.env.AXORA_DATA_DIR
    ? path.resolve(process.env.AXORA_DATA_DIR)
    : path.join(process.cwd(), ".data");
}

function auditFile(): string {
  return path.join(dataDir(), "audit-logs.json");
}

async function readAudit(): Promise<AuditFile> {
  try {
    const raw = await fs.readFile(auditFile(), "utf8");
    const parsed = JSON.parse(raw) as AuditFile;
    if (!parsed || !Array.isArray(parsed.logs)) {
      return { version: 1, logs: [] };
    }
    return parsed;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return { version: 1, logs: [] };
    }
    throw error;
  }
}

async function writeAudit(data: AuditFile): Promise<void> {
  await fs.mkdir(dataDir(), { recursive: true });
  const file = auditFile();
  const temp = `${file}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(temp, JSON.stringify(data, null, 2), "utf8");
  await fs.rename(temp, file);
}

async function withLock<T>(action: () => Promise<T>): Promise<T> {
  const previous = globalForAudit.__axoraAuditLock ?? Promise.resolve();
  let release!: () => void;
  const current = new Promise<void>((resolve) => {
    release = resolve;
  });
  globalForAudit.__axoraAuditLock = previous.then(() => current);
  await previous;
  try {
    return await action();
  } finally {
    release();
  }
}

export async function listPlatformAuditLogs(
  filters: AuditFilters,
  storeNameById: Map<string, string>,
): Promise<Paginated<AuditLog>> {
  const data = await readAudit();
  let rows = data.logs;
  if (filters.storeId) rows = rows.filter((log) => log.storeId === filters.storeId);
  if (filters.action) rows = rows.filter((log) => log.action === filters.action);
  rows = rows
    .slice()
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((log) => ({
      ...log,
      storeName: log.storeId ? storeNameById.get(log.storeId) ?? null : null,
    }));
  return paginate(rows, filters.page ?? 1, filters.pageSize ?? 20);
}

export async function recordPlatformAudit(input: AuditInput): Promise<void> {
  await withLock(async () => {
    const data = await readAudit();
    data.logs.unshift({
      id: `audit_${randomToken(16)}`,
      actorUserId: input.actorUserId,
      actorName: input.actorName,
      storeId: input.storeId,
      storeName: null,
      action: input.action,
      resourceType: input.resourceType,
      resourceId: input.resourceId,
      metadata: input.metadata ?? {},
      createdAt: new Date().toISOString(),
    });
    // Keep the platform audit trail bounded. This is platform metadata, not
    // store business data.
    data.logs = data.logs.slice(0, 5000);
    await writeAudit(data);
  });
}

export async function clearPlatformAuditLogs(): Promise<void> {
  await withLock(async () => {
    await writeAudit({ version: 1, logs: [] });
  });
}
