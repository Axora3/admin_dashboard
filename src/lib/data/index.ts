import { googleSheetsRepository } from "./google-repository";
import type { Repository } from "./repository";

/**
 * Store business data always lives in each store's own Google Spreadsheet
 * (or the clearly-labelled local file emulator during development). There is
 * no central business database.
 */
export function getRepository(): Repository {
  return googleSheetsRepository;
}

export type { Repository, StoreOption, AuditInput } from "./repository";
