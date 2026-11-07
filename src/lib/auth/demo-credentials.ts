import { DEMO_ADMIN_PASSWORD } from "@/lib/config";

const globalForDemoAuth = globalThis as unknown as {
  __axoraDemoPassword?: string;
  __axoraDemoAdminName?: string;
};

export function getDemoPassword(): string {
  return globalForDemoAuth.__axoraDemoPassword ?? DEMO_ADMIN_PASSWORD;
}

export function setDemoPassword(password: string) {
  globalForDemoAuth.__axoraDemoPassword = password;
}

export function getDemoAdminName(): string {
  return globalForDemoAuth.__axoraDemoAdminName ?? "AXORA Super Admin";
}

export function setDemoAdminName(name: string) {
  globalForDemoAuth.__axoraDemoAdminName = name.trim() || "AXORA Super Admin";
}

/** Constant-time-ish comparison for the demo credential check. */
export function safeEqual(a: string, b: string): boolean {
  const encoder = new TextEncoder();
  const left = encoder.encode(a);
  const right = encoder.encode(b);
  const length = Math.max(left.length, right.length);
  let diff = left.length ^ right.length;
  for (let i = 0; i < length; i++) {
    diff |= (left[i] ?? 0) ^ (right[i] ?? 0);
  }
  return diff === 0;
}
