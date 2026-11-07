export function sanitizedMetadata(value: unknown, depth = 0): unknown {
  if (depth > 7) return "[depth limited]";
  if (Array.isArray(value)) return value.slice(0, 100).map(v => sanitizedMetadata(v, depth + 1));
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).filter(([key]) =>
    !/password|token|credential|private.?key|service.?account|spreadsheet|email|phone|address|bank|customer|items|images/i.test(key)
  ).map(([k,v]) => [k,sanitizedMetadata(v, depth + 1)]));
  if (typeof value === "string") return value.slice(0, 1000);
  return value;
}
export const STORE_AUDIT_ACTION = /^(product\.|category\.|order\.|inventory\.|store\.settings_updated$|settings\.save$|auth\.login$|auth\.password_changed$)/;
