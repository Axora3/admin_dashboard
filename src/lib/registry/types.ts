import "server-only";

import type {
  CreateStoreInput,
  DomainStatus,
  SslStatus,
  StoreSettingsData,
  StoreStatus,
  UpdateStoreInput,
  VerificationStatus,
} from "@/lib/types";
import type { StoreSheetsConfig } from "@/lib/google/types";

export interface StoreDomainRecord {
  id: string;
  storeId: string;
  domain: string;
  isPrimary: boolean;
  verificationStatus: VerificationStatus;
  sslStatus: SslStatus;
  status: DomainStatus;
  verificationToken: string;
  expectedTarget: string;
  lastCheckedAt: string | null;
  verifiedAt: string | null;
  createdAt: string;
}

/**
 * Store registry is configuration only: identity, domain, settings and the
 * Google Sheets connection. It never contains products, orders or customers.
 */
export interface StoreRecord {
  id: string;
  name: string;
  slug: string;
  businessType: string;
  description: string;
  logoUrl: string | null;
  status: StoreStatus;
  currency: string;
  language: string;
  phone: string;
  email: string;
  address: string;
  ownerName: string;
  ownerEmail: string;
  ownerPhone: string;
  createdAt: string;
  updatedAt: string;
  settings: StoreSettingsData;
  sheets: StoreSheetsConfig;
  domains: StoreDomainRecord[];
}

export interface RegistryData {
  version: 1;
  stores: StoreRecord[];
}

export interface StoreRegistry {
  readonly kind: "file" | "supabase";
  list(): Promise<StoreRecord[]>;
  get(idOrSlug: string): Promise<StoreRecord | null>;
  create(input: CreateStoreInput): Promise<StoreRecord>;
  update(id: string, input: UpdateStoreInput): Promise<StoreRecord>;
  updateSheets(id: string, sheets: StoreSheetsConfig): Promise<StoreRecord>;
  updateSettings(
    id: string,
    settings: StoreSettingsData,
  ): Promise<StoreRecord>;
  setStatus(id: string, status: StoreStatus): Promise<void>;
  delete(id: string): Promise<void>;
  findByDomain(domain: string): Promise<StoreRecord | null>;
  createDomain(
    storeId: string,
    domain: string,
    isPrimary: boolean,
  ): Promise<StoreDomainRecord>;
  updateDomain(
    storeId: string,
    domainId: string,
    patch: Partial<
      Pick<
        StoreDomainRecord,
        | "domain"
        | "isPrimary"
        | "verificationStatus"
        | "sslStatus"
        | "status"
        | "lastCheckedAt"
        | "verifiedAt"
      >
    >,
  ): Promise<StoreDomainRecord>;
  deleteDomain(storeId: string, domainId: string): Promise<void>;
}
