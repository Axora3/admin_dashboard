import { z } from "zod";
import type { DeliveryDetails } from "@/lib/types";

export const DELIVERY_METHODS = ["store_delivery", "pickup", "courier"] as const;
export const DELIVERY_METHOD_LABELS: Record<DeliveryDetails["method"], string> = {
  store_delivery: "Дэлгүүр өөрөө хүргэнэ",
  pickup: "Дэлгүүрээс авах",
  courier: "Хүргэлтийн байгууллага",
};

const coordinates = {
  latitude: z.number().finite().min(-90).max(90).nullable(),
  longitude: z.number().finite().min(-180).max(180).nullable(),
};

function pairedCoordinates(value: { latitude: number | null; longitude: number | null }) {
  return (value.latitude === null) === (value.longitude === null);
}

export const deliveryLocationSchema = z.object(coordinates).strict().refine(pairedCoordinates, {
  message: "Байршлын өргөрөг, уртрагыг хамт оруулна уу.",
  path: ["latitude"],
});

export const deliverySchema = z.object({
  method: z.enum(DELIVERY_METHODS),
  ...coordinates,
  driverName: z.string().trim().max(120),
  driverPhone: z.string().trim().max(40),
  note: z.string().trim().max(1000),
}).strict().refine(pairedCoordinates, {
  message: "Байршлын өргөрөг, уртрагыг хамт оруулна уу.",
  path: ["latitude"],
});

/** Invalid legacy cells never become map coordinates or executable markup. */
export function parseDelivery(value: string): DeliveryDetails | null {
  if (!value.trim()) return null;
  try {
    const result = deliverySchema.safeParse(JSON.parse(value));
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}

export function hasDeliveryCoordinates(
  value: { latitude: number | null; longitude: number | null } | null | undefined,
): value is { latitude: number; longitude: number } {
  return Boolean(value && typeof value.latitude === "number" && Number.isFinite(value.latitude)
    && value.latitude >= -90 && value.latitude <= 90
    && typeof value.longitude === "number" && Number.isFinite(value.longitude)
    && value.longitude >= -180 && value.longitude <= 180);
}
