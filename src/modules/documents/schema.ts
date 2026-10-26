import { z } from "zod";
export const sectionLabels = {
  cover: "Portada",
  thanks: "Agradecimiento",
  scope: "Alcance",
  budget: "Presupuesto",
  conditions: "Condiciones",
  acceptance: "Aceptación y firmas",
};
export const sectionSchema = z.enum([
  "cover",
  "thanks",
  "scope",
  "budget",
  "conditions",
  "acceptance",
]);
export const documentOptionsSchema = z.object({
  sections: z
    .array(sectionSchema)
    .min(1)
    .max(6)
    .refine(
      (list) => list.includes("budget") && new Set(list).size === list.length,
      "Incluye el presupuesto una sola vez y evita secciones duplicadas.",
    ),
  margins: z.object({
    top: z.number().min(22).max(60),
    bottom: z.number().min(26).max(60),
    left: z.number().min(12).max(45),
    right: z.number().min(24).max(50),
  }),
});
export type DocumentOptions = z.infer<typeof documentOptionsSchema>;
export const defaultDocumentOptions: DocumentOptions = {
  sections: ["scope", "budget", "conditions", "acceptance"],
  margins: { top: 26, bottom: 29, left: 16, right: 32 },
};
export const quoteSnapshotSchema = z.object({
  folio: z.string(),
  issued_at: z.string(),
  organization: z.object({ name: z.string() }),
  client: z.object({
    name: z.string(),
    email: z.string(),
    phone: z.string(),
    address: z.string(),
  }),
  quote: z.object({
    name: z.string(),
    currency: z.literal("MXN"),
    vat_rate: z.coerce.number(),
    apply_vat: z.boolean(),
    advance_rate: z.coerce.number(),
    valid_until: z.string(),
    notes: z.string(),
    conditions: z.string(),
    subtotal_cents: z.coerce.number().int().safe(),
    discount_cents: z.coerce.number().int().safe(),
    tax_cents: z.coerce.number().int().safe(),
    total_cents: z.coerce.number().int().safe(),
  }),
  items: z.array(
    z.object({
      code: z.string().optional(),
      name: z.string(),
      description: z.string(),
      quantity: z.coerce.string(),
      unit: z.string(),
      unit_price_cents: z.coerce.number().int().safe(),
      discount_rate: z.coerce.string(),
      business_line_id: z.uuid(),
    }),
  ),
  options: documentOptionsSchema,
});
export type QuoteSnapshot = z.infer<typeof quoteSnapshotSchema>;
export interface DocumentRenderer<T = QuoteSnapshot> {
  render(snapshot: T): Promise<Buffer>;
}
