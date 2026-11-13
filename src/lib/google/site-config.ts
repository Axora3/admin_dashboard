import "server-only";
import type { StoreRecord } from "@/lib/registry/types";
import type { SheetModule, SiteIntegrationConfig } from "./data-contracts";
import { canonicalBusinessType, modulesForBusiness } from "./schema-registry";

/** Resolve legacy registry records into the canonical contract without a DB migration. */
export function siteIntegrationConfig(record: StoreRecord): SiteIntegrationConfig {
  const businessType = canonicalBusinessType(record.businessType);
  const allowedModules = modulesForBusiness(businessType);
  const enabledModules = record.sheets.enabledModules?.filter((module): module is SheetModule => allowedModules.includes(module as SheetModule));
  return {
    site_id: record.id,
    business_type: businessType,
    spreadsheet_id: record.sheets.spreadsheetId,
    schema_version: record.sheets.schemaVersion ?? 1,
    enabled_modules: enabledModules ?? allowedModules,
    integration_status: record.sheets.connectionStatus,
    last_successful_sync: record.sheets.lastSuccessfulSync ?? record.sheets.lastSyncAt,
    configuration_version: record.sheets.configurationVersion ?? 1,
  };
}

/** Safe for the customer dashboard UI: deliberately excludes spreadsheet_id. */
export function publicSiteIntegrationConfig(record: StoreRecord) {
  const config = siteIntegrationConfig(record);
  const { spreadsheet_id: _private, ...safe } = config;
  return safe;
}
