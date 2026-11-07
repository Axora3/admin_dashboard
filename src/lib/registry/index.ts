import "server-only";

import { fileStoreRegistry } from "./file-registry";
import type { StoreRegistry } from "./types";

/**
 * The store registry is configuration only (identity, domains, settings and
 * Google Sheets connection). It is deliberately separate from store business
 * data, which always lives in each store's own spreadsheet.
 *
 * A Supabase/Postgres registry adapter can be added behind this interface for
 * multi-instance deployments without changing the repository or UI.
 */
export function getStoreRegistry(): StoreRegistry {
  return fileStoreRegistry;
}

export { fileStoreRegistry };
export type { StoreRecord, StoreDomainRecord, StoreRegistry } from "./types";
