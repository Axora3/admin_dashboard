import type { AdminUser } from "@/lib/types";
export const STORE_PERMISSIONS = ["orders.read","orders.manage","products.read","products.manage","customers.read","customers.manage","analytics.read","settings.manage","notifications.read","audit.read"] as const;
export type Permission = typeof STORE_PERMISSIONS[number];
export function hasPermission(admin: AdminUser, permission: Permission, storeId: string): boolean {
  return admin.isSuperAdmin || (admin.role === "store_admin" && admin.storeId === storeId && STORE_PERMISSIONS.includes(permission));
}
export function assertPermission(admin: AdminUser, permission: Permission, storeId: string) {
  if (!hasPermission(admin, permission, storeId)) throw new Error("Энэ үйлдэлд эрх хүрэлцэхгүй.");
}
