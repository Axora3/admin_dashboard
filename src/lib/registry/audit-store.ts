import "server-only";

import { promises as fs } from "node:fs";
import path from "node:path";
import { checked, platformDb, platformEnabled } from "@/lib/platform/db";
import { sanitizedMetadata, STORE_AUDIT_ACTION } from "@/lib/platform/sanitize";
import { storeScope } from "@/lib/auth/store-scope";
import { publishNotification } from "@/lib/platform/notifications";
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
  if (platformEnabled()) {
    const page = Math.max(1, filters.page ?? 1), size = Math.min(100, Math.max(1,filters.pageSize ?? 20));
    let query = platformDb().from("platform_audit").select("*",{count:"exact"});
    const storeId = storeScope.getStore() ?? filters.storeId;
    if (storeId) query = query.eq("store_id",storeId);
    if (filters.actorUserId) query=query.eq("actor_id",filters.actorUserId);
    if (filters.action) query=query.eq("action",filters.action);
    if (storeScope.getStore()) query=query.in("resource_type",["product","category","order","inventory","store_settings","settings","session","admin"]);
    const {data,count} = checked(await query.order("created_at",{ascending:false}).range((page-1)*size,page*size-1));
    const rows: AuditLog[] = (data??[]).filter(l=>!storeScope.getStore() || STORE_AUDIT_ACTION.test(l.action)).map(l=>({id:l.id,actorUserId:l.actor_id,actorName:l.actor_name,storeId:l.store_id,storeName:storeNameById.get(l.store_id)??null,action:l.action,resourceType:l.resource_type,resourceId:l.resource_id,metadata:sanitizedMetadata(l.metadata) as Record<string,unknown>,createdAt:l.created_at}));
    return {rows,total:count??0,page,pageSize:size,pageCount:Math.ceil((count??0)/size)};
  }
  const data = await readAudit();
  let rows = data.logs;
  if (filters.actorUserId) rows = rows.filter((log) => log.actorUserId === filters.actorUserId);
  if (filters.storeId) rows = rows.filter((log) => log.storeId === filters.storeId);
  if (filters.action) rows = rows.filter((log) => log.action === filters.action);
  if (storeScope.getStore()) rows = rows.filter(log => log.storeId === storeScope.getStore() && STORE_AUDIT_ACTION.test(log.action)).map(log=>({...log,metadata:sanitizedMetadata(log.metadata) as Record<string,unknown>}));
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
  if (platformEnabled()) {
    const entry = checked(await platformDb().from("platform_audit").insert({actor_id:input.actorUserId,actor_name:input.actorName,store_id:input.storeId,action:input.action,resource_type:input.resourceType,resource_id:input.resourceId,metadata:sanitizedMetadata(input.metadata??{})}).select("id").single());
    if (/^(store\.created|admin\.|domain\.|subscription\.|backup\.|restore\.|sheets\.)/.test(input.action)) {
      await publishNotification({ key:`audit:${entry.data!.id}`,storeId:input.storeId,category:input.action.split(".")[0],title:input.action,audience:"platform" });
    }
    return;
  }
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
