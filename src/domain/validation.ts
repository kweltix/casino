import { z } from "zod";
export const webUrl = z
  .string()
  .max(2048)
  .url()
  .refine((v) => {
    const u = new URL(v);
    return (
      ["http:", "https:"].includes(u.protocol) && !u.username && !u.password
    );
  }, "Нужна публичная http(s)-ссылка без пароля");
export const sourceSchema = z
  .object({
    id: z.string().min(1).max(120),
    url: webUrl,
    fetchedAt: z.iso.datetime(),
    excerpt: z.string().max(8000),
  })
  .strict();
export const runSchema = z
  .object({
    city: z.literal("Екатеринбург").default("Екатеринбург"),
    niche: z.literal("автосервисы").default("автосервисы"),
    limit: z.number().int().min(1).max(20).default(20),
  })
  .strict();
export const companyInputSchema = z
  .object({
    name: z.string().trim().min(1).max(200),
    address: z.string().trim().min(3).max(500),
    sourceId: z.string().trim().min(1).max(300).optional(),
    phone: z.string().max(100).optional(),
    website: webUrl.optional(),
    sources: z.array(sourceSchema).min(1).max(30),
    origin: z.enum(["manual", "search", "test"]).default("manual"),
  })
  .strict();
export const editSchema = z
  .object({
    version: z.number().int().min(1),
    draftMessage: z.string().max(8000).optional(),
    contactStatus: z
      .enum(["new", "reviewed", "rejected", "contacted"])
      .optional(),
  })
  .strict();
export type CompanyInput = z.input<typeof companyInputSchema>;
export type RunInput = z.input<typeof runSchema>;
