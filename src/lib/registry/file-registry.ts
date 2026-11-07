import "server-only";

import { promises as fs } from "node:fs";
import path from "node:path";
import { AsyncLocalStorage } from "node:async_hooks";
import { checked, platformDb, platformEnabled } from "@/lib/platform/db";
import type { CreateStoreInput, UpdateStoreInput } from "@/lib/types";
import { defaultStoreSettings } from "@/lib/data/defaults";
import {
  cloneColumns,
  defaultSheetsConfig,
  extractSpreadsheetId,
  spreadsheetUrl,
  type StoreSheetsConfig,
} from "@/lib/google/types";
import { normalizeDomain, randomToken, slugify } from "@/lib/utils";
import type {
  RegistryData,
  StoreDomainRecord,
  StoreRecord,
  StoreRegistry,
} from "./types";

const globalForRegistry = globalThis as unknown as {
  __axoraRegistryLocks?: Map<string, Promise<void>>;
};
const registryRevision = new AsyncLocalStorage<{ value: number }>();

function dataDir(): string {
  return process.env.AXORA_DATA_DIR
    ? path.resolve(process.env.AXORA_DATA_DIR)
    : path.join(process.cwd(), ".data");
}

function registryFile(): string {
  return path.join(dataDir(), "registry.json");
}

async function withLock<T>(action: () => Promise<T>): Promise<T> {
  const file = registryFile();
  if (!globalForRegistry.__axoraRegistryLocks) {
    globalForRegistry.__axoraRegistryLocks = new Map();
  }
  const locks = globalForRegistry.__axoraRegistryLocks;
  const previous = locks.get(file) ?? Promise.resolve();
  let release!: () => void;
  const current = new Promise<void>((resolve) => {
    release = resolve;
  });
  locks.set(file, previous.then(() => current));
  await previous;
  try {
    return await registryRevision.run({ value: -1 }, action);
  } finally {
    release();
    if (locks.get(file) === current) locks.delete(file);
  }
}

async function readRegistry(): Promise<RegistryData> {
  if (platformEnabled()) {
    const { data } = checked(await platformDb().from("platform_registry").select("payload,revision").eq("id", true).single());
    if (registryRevision.getStore()) registryRevision.getStore()!.value = data!.revision;
    return { version: 1, stores: (data!.payload.stores as StoreRecord[]).map(s => ({ ...s, settings: defaultStoreSettings() })) };
  }
  try {
    const raw = await fs.readFile(registryFile(), "utf8");
    const parsed = JSON.parse(raw) as RegistryData;
    if (!parsed || !Array.isArray(parsed.stores)) {
      return { version: 1, stores: [] };
    }
    return parsed;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return { version: 1, stores: [] };
    }
    throw error;
  }
}

async function writeRegistry(data: RegistryData): Promise<void> {
  if (platformEnabled()) {
    const payload = { version: 1, stores: data.stores.map(({ settings: _businessSettings, ...store }) => store) };
    checked(await platformDb().rpc("axora_save_registry", { expected_revision: registryRevision.getStore()?.value ?? -1, next_payload: payload }));
    return;
  }
  await fs.mkdir(dataDir(), { recursive: true });
  const file = registryFile();
  const temp = `${file}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(temp, JSON.stringify(data, null, 2), "utf8");
  await fs.rename(temp, file);
}

function nowIso() {
  return new Date().toISOString();
}

function ensureUnique(
  stores: StoreRecord[],
  input: { id?: string; slug?: string; domain?: string },
  ignoreId?: string,
) {
  for (const store of stores) {
    if (store.id === ignoreId) continue;
    if (input.id && store.id.toLowerCase() === input.id.toLowerCase()) {
      throw new Error("Энэ Store ID аль хэдийн ашиглагдаж байна.");
    }
    if (input.slug && store.slug.toLowerCase() === input.slug.toLowerCase()) {
      throw new Error("Энэ slug аль хэдийн ашиглагдаж байна.");
    }
    if (input.domain) {
      const domain = normalizeDomain(input.domain);
      if (store.domains.some((entry) => entry.domain === domain)) {
        throw new Error("Энэ домэйн аль хэдийн бүртгэгдсэн байна.");
      }
    }
  }
}

function buildSheetsConfig(input: CreateStoreInput): StoreSheetsConfig {
  const base = defaultSheetsConfig();
  if (!input.sheets) return base;
  const spreadsheetId = extractSpreadsheetId(
    input.sheets.spreadsheetId || input.sheets.spreadsheetUrl,
  );
  return {
    ...base,
    spreadsheetId,
    spreadsheetUrl: input.sheets.spreadsheetUrl || spreadsheetUrl(spreadsheetId),
    tabs: { ...base.tabs, ...input.sheets.tabs },
    columns: input.sheets.columns
      ? cloneColumns(input.sheets.columns)
      : base.columns,
  };
}

function buildStore(input: CreateStoreInput): StoreRecord {
  const id =
    input.storeId?.trim() ||
    `store_${slugify(input.slug || input.name).replace(/-/g, "_").slice(0, 32) || randomToken(8)}`;
  const slug = slugify(input.slug || input.name) || id;
  const createdAt = nowIso();
  const domains: StoreDomainRecord[] = [];
  if (input.domain) {
    domains.push(createDomainRecord(id, input.domain, input.domainIsPrimary));
  }
  return {
    id,
    name: input.name.trim(),
    slug,
    businessType: input.businessType,
    description: input.description,
    logoUrl: input.logoUrl,
    status: input.status,
    currency: input.currency,
    language: input.language,
    phone: input.phone,
    email: input.email,
    address: input.address,
    ownerName: input.ownerName,
    ownerEmail: input.ownerEmail,
    ownerPhone: input.ownerPhone,
    createdAt,
    updatedAt: createdAt,
    settings: defaultStoreSettings(input.theme),
    sheets: buildSheetsConfig(input),
    domains,
  };
}

function createDomainRecord(
  storeId: string,
  domainInput: string,
  isPrimary: boolean,
): StoreDomainRecord {
  const domain = normalizeDomain(domainInput);
  return {
    id: `dom_${randomToken(12)}`,
    storeId,
    domain,
    isPrimary,
    verificationStatus: "pending",
    sslStatus: "none",
    status: "pending",
    verificationToken: `axora-verify-${randomToken(24)}`,
    expectedTarget: "cname.axora.mn",
    lastCheckedAt: null,
    verifiedAt: null,
    createdAt: nowIso(),
  };
}

export class FileStoreRegistry implements StoreRegistry {
  get kind(): "file" | "supabase" { return platformEnabled() ? "supabase" : "file"; }

  async list(): Promise<StoreRecord[]> {
    return (await readRegistry()).stores;
  }

  async get(idOrSlug: string): Promise<StoreRecord | null> {
    const value = idOrSlug.toLowerCase();
    const store = (await readRegistry()).stores.find(
      (entry) =>
        entry.id.toLowerCase() === value ||
        entry.slug.toLowerCase() === value,
    );
    return store ?? null;
  }

  async create(input: CreateStoreInput): Promise<StoreRecord> {
    return withLock(async () => {
      const data = await readRegistry();
      const store = buildStore(input);
      ensureUnique(data.stores, {
        id: store.id,
        slug: store.slug,
        domain: store.domains[0]?.domain,
      });
      data.stores.push(store);
      await writeRegistry(data);
      return store;
    });
  }

  async update(id: string, input: UpdateStoreInput): Promise<StoreRecord> {
    return withLock(async () => {
      const data = await readRegistry();
      const store = data.stores.find((entry) => entry.id === id);
      if (!store) throw new Error("Дэлгүүр олдсонгүй.");

      const nextSlug = input.slug ? slugify(input.slug) : store.slug;
      ensureUnique(
        data.stores,
        {
          slug: nextSlug,
          domain: input.domain || undefined,
        },
        id,
      );

      const theme = input.theme ?? store.settings.theme.style;
      store.name = input.name ?? store.name;
      store.slug = nextSlug || store.slug;
      store.businessType = input.businessType ?? store.businessType;
      store.description = input.description ?? store.description;
      store.logoUrl = input.logoUrl ?? store.logoUrl;
      store.status = input.status ?? store.status;
      store.currency = input.currency ?? store.currency;
      store.language = input.language ?? store.language;
      store.phone = input.phone ?? store.phone;
      store.email = input.email ?? store.email;
      store.address = input.address ?? store.address;
      store.ownerName = input.ownerName ?? store.ownerName;
      store.ownerEmail = input.ownerEmail ?? store.ownerEmail;
      store.ownerPhone = input.ownerPhone ?? store.ownerPhone;
      store.settings = {
        ...store.settings,
        theme: {
          ...store.settings.theme,
          style: theme,
          primary:
            store.settings.theme.style === theme
              ? store.settings.theme.primary
              : defaultStoreSettings(theme).theme.primary,
          accent:
            store.settings.theme.style === theme
              ? store.settings.theme.accent
              : defaultStoreSettings(theme).theme.accent,
        },
      };
      store.updatedAt = nowIso();

      if (input.domain !== undefined) {
        const domain = normalizeDomain(input.domain);
        const primary = store.domains.find((entry) => entry.isPrimary);
        if (!domain) {
          store.domains = store.domains.filter((entry) => !entry.isPrimary);
          const next = store.domains[0];
          if (next) next.isPrimary = true;
        } else if (primary) {
          if (primary.domain !== domain) {
            ensureUnique(data.stores, { domain }, id);
            primary.domain = domain;
            primary.verificationStatus = "pending";
            primary.sslStatus = "none";
            primary.status = "pending";
            primary.lastCheckedAt = null;
            primary.verifiedAt = null;
          }
        } else {
          ensureUnique(data.stores, { domain }, id);
          store.domains.push(
            createDomainRecord(id, domain, input.domainIsPrimary ?? true),
          );
        }
      }

      await writeRegistry(data);
      return store;
    });
  }

  async updateSheets(
    id: string,
    sheets: StoreSheetsConfig,
  ): Promise<StoreRecord> {
    return withLock(async () => {
      const data = await readRegistry();
      const store = data.stores.find((entry) => entry.id === id);
      if (!store) throw new Error("Дэлгүүр олдсонгүй.");
      store.sheets = {
        ...sheets,
        columns: cloneColumns(sheets.columns),
        tabs: { ...sheets.tabs },
      };
      store.updatedAt = nowIso();
      await writeRegistry(data);
      return store;
    });
  }

  async updateSettings(
    id: string,
    settings: StoreRecord["settings"],
  ): Promise<StoreRecord> {
    return withLock(async () => {
      const data = await readRegistry();
      const store = data.stores.find((entry) => entry.id === id);
      if (!store) throw new Error("Дэлгүүр олдсонгүй.");
      store.settings = settings;
      store.updatedAt = nowIso();
      await writeRegistry(data);
      return store;
    });
  }

  async setStatus(id: string, status: StoreRecord["status"]): Promise<void> {
    await withLock(async () => {
      const data = await readRegistry();
      const store = data.stores.find((entry) => entry.id === id);
      if (!store) throw new Error("Дэлгүүр олдсонгүй.");
      store.status = status;
      store.updatedAt = nowIso();
      await writeRegistry(data);
    });
  }

  async delete(id: string): Promise<void> {
    await withLock(async () => {
      const data = await readRegistry();
      data.stores = data.stores.filter((entry) => entry.id !== id);
      await writeRegistry(data);
    });
  }

  async findByDomain(domainInput: string): Promise<StoreRecord | null> {
    const domain = normalizeDomain(domainInput);
    if (!domain) return null;
    const store = (await readRegistry()).stores.find((entry) =>
      entry.domains.some((item) => item.domain === domain),
    );
    return store ?? null;
  }

  async createDomain(
    storeId: string,
    domainInput: string,
    isPrimary: boolean,
  ): Promise<StoreDomainRecord> {
    return withLock(async () => {
      const data = await readRegistry();
      const store = data.stores.find((entry) => entry.id === storeId);
      if (!store) throw new Error("Дэлгүүр олдсонгүй.");
      const domain = normalizeDomain(domainInput);
      ensureUnique(data.stores, { domain });
      if (isPrimary) {
        for (const entry of store.domains) entry.isPrimary = false;
      }
      const record = createDomainRecord(storeId, domain, isPrimary);
      store.domains.push(record);
      store.updatedAt = nowIso();
      await writeRegistry(data);
      return record;
    });
  }

  async updateDomain(
    storeId: string,
    domainId: string,
    patch: Parameters<StoreRegistry["updateDomain"]>[2],
  ): Promise<StoreDomainRecord> {
    return withLock(async () => {
      const data = await readRegistry();
      const store = data.stores.find((entry) => entry.id === storeId);
      if (!store) throw new Error("Дэлгүүр олдсонгүй.");
      const domain = store.domains.find((entry) => entry.id === domainId);
      if (!domain) throw new Error("Домэйн олдсонгүй.");
      if (patch.domain) {
        const normalized = normalizeDomain(patch.domain);
        ensureUnique(data.stores, { domain: normalized }, storeId);
        domain.domain = normalized;
      }
      if (patch.isPrimary) {
        for (const entry of store.domains) entry.isPrimary = false;
        domain.isPrimary = true;
      }
      if (patch.verificationStatus !== undefined) {
        domain.verificationStatus = patch.verificationStatus;
      }
      if (patch.sslStatus !== undefined) domain.sslStatus = patch.sslStatus;
      if (patch.status !== undefined) domain.status = patch.status;
      if (patch.lastCheckedAt !== undefined) {
        domain.lastCheckedAt = patch.lastCheckedAt;
      }
      if (patch.verifiedAt !== undefined) domain.verifiedAt = patch.verifiedAt;
      store.updatedAt = nowIso();
      await writeRegistry(data);
      return domain;
    });
  }

  async deleteDomain(storeId: string, domainId: string): Promise<void> {
    await withLock(async () => {
      const data = await readRegistry();
      const store = data.stores.find((entry) => entry.id === storeId);
      if (!store) throw new Error("Дэлгүүр олдсонгүй.");
      const removed = store.domains.find((entry) => entry.id === domainId);
      store.domains = store.domains.filter((entry) => entry.id !== domainId);
      if (removed?.isPrimary && store.domains[0]) {
        store.domains[0].isPrimary = true;
      }
      store.updatedAt = nowIso();
      await writeRegistry(data);
    });
  }
}

export const fileStoreRegistry = new FileStoreRegistry();
