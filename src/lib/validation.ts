import { z } from "zod";
import { isValidDomain } from "./utils";

export function formObject(formData: FormData): Record<string, string> {
  const object: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === "string") object[key] = value;
  }
  return object;
}

const nullableNumber = z.preprocess(
  (value) => (value === "" || value === null || value === undefined ? null : value),
  z.coerce.number().min(0).nullable(),
);

const optionalText = z.string().trim().optional().default("");

export const loginSchema = z.object({
  email: z.string().trim().min(1, "Имэйл эсвэл нэвтрэх нэрээ оруулна уу."),
  password: z.string().min(1, "Нууц үгээ оруулна уу."),
});

export const storeSchema = z
  .object({
    name: z.string().trim().min(2, "Дэлгүүрийн нэр дор хаяж 2 тэмдэгт байна."),
    slug: optionalText,
    businessType: z.string().trim().min(1, "Бизнесийн төрлийг сонгоно уу."),
    description: z.string().trim().max(2000, "Тайлбар хэт урт байна.").optional().default(""),
    logoUrl: optionalText,
    phone: z.string().trim().min(6, "Утасны дугаар оруулна уу."),
    email: z.string().trim().email("Имэйл хаяг буруу байна."),
    address: optionalText,
    ownerName: z.string().trim().min(2, "Эзэмшигчийн нэрийг оруулна уу."),
    ownerEmail: z.string().trim().email("Эзэмшигчийн имэйл буруу байна."),
    ownerPhone: z.string().trim().min(6, "Эзэмшигчийн утасны дугаар оруулна уу."),
    domain: optionalText,
    domainIsPrimary: z.boolean().optional().default(true),
    status: z.enum(["active", "suspended", "archived"]),
    currency: z.string().trim().default("MNT"),
    language: z.string().trim().default("mn"),
    theme: z.enum(["minimal", "editorial", "bold"]),
  })
  .superRefine((data, context) => {
    if (data.domain && !isValidDomain(data.domain)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["domain"],
        message: "Домэйн формат буруу байна. Жишээ: store.mn",
      });
    }
    if (data.logoUrl && !/^https?:\/\//i.test(data.logoUrl)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["logoUrl"],
        message: "Logo URL http(s)://-ээр эхлэх ёстой.",
      });
    }
  });

export const productSchema = z.object({
  storeId: z.string().trim().min(1, "Дэлгүүр сонгоно уу."),
  name: z.string().trim().min(2, "Барааны нэр дор хаяж 2 тэмдэгт байна."),
  slug: optionalText,
  description: z.string().trim().max(4000).optional().default(""),
  price: z.coerce.number().min(0, "Үнэ 0-ээс бага байж болохгүй."),
  salePrice: nullableNumber,
  stock: z.coerce.number().int().min(0, "Үлдэгдэл 0-ээс бага байж болохгүй."),
  sku: optionalText,
  categoryId: z.string().trim().optional().default(""),
  isActive: z.boolean().optional().default(true),
  isFeatured: z.boolean().optional().default(false),
  isNew: z.boolean().optional().default(false),
});

export const categorySchema = z.object({
  storeId: z.string().trim().min(1, "Дэлгүүр сонгоно уу."),
  name: z.string().trim().min(1, "Ангиллын нэрийг оруулна уу."),
  slug: optionalText,
  description: z.string().trim().max(1000).optional().default(""),
  imageUrl: optionalText,
  sortOrder: z.coerce.number().int().min(0).default(0),
});

export const domainSchema = z
  .object({
    storeId: z.string().trim().min(1, "Дэлгүүр сонгоно уу."),
    domain: z.string().trim().min(3, "Домэйн оруулна уу."),
    isPrimary: z.boolean().optional().default(false),
  })
  .superRefine((data, context) => {
    if (!isValidDomain(data.domain)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["domain"],
        message: "Домэйн формат буруу байна.",
      });
    }
  });

export const inventorySchema = z.object({
  productId: z.string().trim().min(1),
  changeAmount: z.coerce
    .number()
    .int("Бүхэл тоо оруулна уу.")
    .refine((value) => value !== 0, "0-ээс ялгаатай утга оруулна уу."),
  reason: z.string().trim().min(1, "Шалтгааныг сонгоно уу."),
  note: optionalText,
});

export const storeSettingsSchema = z.object({
  storeId: z.string().trim().min(1),
  name: z.string().trim().min(2, "Дэлгүүрийн нэр дор хаяж 2 тэмдэгт байна."),
  logoUrl: optionalText,
  description: z.string().trim().max(2000).optional().default(""),
  phone: z.string().trim().min(6, "Утасны дугаар оруулна уу."),
  email: z.string().trim().email("Имэйл хаяг буруу байна."),
  address: optionalText,
  facebook: optionalText,
  instagram: optionalText,
  currency: z.string().trim().default("MNT"),
  language: z.string().trim().default("mn"),
  theme: z.enum(["minimal", "editorial", "bold"]),
  shippingEnabled: z.boolean().default(true),
  shippingFlatRate: z.coerce.number().min(0).default(0),
  shippingFreeOver: z.coerce.number().min(0).default(0),
  shippingNote: optionalText,
  codEnabled: z.boolean().default(true),
  bankTransferEnabled: z.boolean().default(true),
  bankAccount: optionalText,
  paymentNote: optionalText,
  published: z.boolean().default(true),
  showOutOfStock: z.boolean().default(false),
});

export const profileSchema = z.object({
  fullName: z.string().trim().min(2, "Нэрээ оруулна уу."),
});

export const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, "Одоогийн нууц үгээ оруулна уу."),
    newPassword: z
      .string()
      .min(8, "Шинэ нууц үг дор хаяж 8 тэмдэгт байна.")
      .regex(/[A-Za-z]/, "Үсэг агуулсан байх ёстой.")
      .regex(/[0-9]/, "Тоо агуулсан байх ёстой."),
    confirmPassword: z.string().min(1, "Нууц үгээ давтана уу."),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    path: ["confirmPassword"],
    message: "Нууц үг таарахгүй байна.",
  });

export type StoreFormValues = z.infer<typeof storeSchema>;
export type ProductFormValues = z.infer<typeof productSchema>;
export type CategoryFormValues = z.infer<typeof categorySchema>;
export type StoreSettingsFormValues = z.infer<typeof storeSettingsSchema>;

export function zodErrors(error: z.ZodError): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "form";
    if (!errors[key]) errors[key] = issue.message;
  }
  return errors;
}
