export interface ActionResult {
  ok: boolean;
  message?: string;
  errors?: Record<string, string>;
}

export const emptyResult: ActionResult = { ok: false };
