import type { AdminUser } from "@/lib/types";

/**
 * Centralized permission architecture.
 *
 * Only `super_admin` and `store_admin` are ACTIVE today. `store_manager` and
 * `store_staff` are modelled so the matrix, database enum and server checks are
 * ready, but they are deliberately not exposed in the UI and are denied by
 * `getCurrentAdmin()` until the roles are launched.
 */
export const STORE_PERMISSIONS = [
  "orders.read",
  "orders.manage",
  "products.read",
  "products.manage",
  "customers.read",
  "customers.manage",
  "analytics.read",
  "settings.manage",
  "notifications.read",
  "audit.read",
] as const;
export type Permission = (typeof STORE_PERMISSIONS)[number];

export type PlatformRole = "super_admin" | "store_admin" | "store_manager" | "store_staff";

/** Roles that may currently sign in. Future roles stay disabled. */
export const ACTIVE_ROLES: readonly PlatformRole[] = ["super_admin", "store_admin"];

export const ROLE_PERMISSIONS: Record<Exclude<PlatformRole, "super_admin">, readonly Permission[]> = {
  store_admin: STORE_PERMISSIONS,
  // Future: operational manager without store settings.
  store_manager: [
    "orders.read", "orders.manage", "products.read", "products.manage",
    "customers.read", "analytics.read", "notifications.read",
  ],
  // Future: fulfilment staff, read mostly.
  store_staff: ["orders.read", "orders.manage", "products.read", "notifications.read"],
};

export function isActiveRole(role: string): role is PlatformRole {
  return (ACTIVE_ROLES as readonly string[]).includes(role);
}

export function permissionsFor(role: string): readonly Permission[] {
  if (!isActiveRole(role) || role === "super_admin") return role === "super_admin" ? STORE_PERMISSIONS : [];
  return ROLE_PERMISSIONS[role as keyof typeof ROLE_PERMISSIONS] ?? [];
}

export function hasPermission(
  admin: Pick<AdminUser, "role" | "storeId" | "isSuperAdmin">,
  permission: Permission,
  storeId: string,
): boolean {
  if (admin.isSuperAdmin) return true;
  if (!isActiveRole(admin.role) || !admin.storeId || admin.storeId !== storeId) return false;
  return permissionsFor(admin.role).includes(permission);
}

export function assertPermission(
  admin: Pick<AdminUser, "role" | "storeId" | "isSuperAdmin">,
  permission: Permission,
  storeId: string,
) {
  if (!hasPermission(admin, permission, storeId)) throw new Error("Энэ үйлдэлд эрх хүрэлцэхгүй.");
}
