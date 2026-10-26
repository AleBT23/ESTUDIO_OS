import { z } from "zod";
export const units = {
  m2: "Por m²",
  unit: "Por unidad",
  hour: "Por hora",
  visit: "Por visita",
  fixed: "Honorario fijo",
  pct: "Porcentaje de obra",
};
export const decimalInput = z
  .string()
  .regex(
    /^\d{1,12}(\.\d{1,4})?$/,
    "Escribe un número positivo con hasta 4 decimales.",
  );
export const moneyInput = z
  .string()
  .regex(
    /^\d{1,12}(\.\d{1,2})?$/,
    "Escribe un importe positivo con hasta 2 decimales.",
  );
export const percentage = decimalInput.refine(
  (v) => Number(v) <= 100,
  "El porcentaje debe estar entre 0 y 100.",
);
export const serviceSchema = z
  .object({
    name: z.string().trim().min(2).max(160),
    code: z.string().trim().min(1).max(40),
    category: z.string().trim().max(100),
    business_line_id: z.uuid(),
    unit: z.enum(["m2", "unit", "hour", "visit", "fixed", "pct"]),
    price: moneyInput,
    estimatedCost: moneyInput,
    description: z.string().trim().max(10000),
    valid_until: z.union([z.literal(""), z.iso.date()]),
  })
  .refine(
    (s) => s.unit !== "pct" || Number(s.price) <= 100,
    "El porcentaje de obra no puede superar 100.",
  );
export type Service = {
  id: string;
  name: string;
  code: string;
  category: string;
  business_line_id: string;
  unit: keyof typeof units;
  price_cents: number;
  estimated_cost_cents: number;
  description: string;
  valid_until: string | null;
  version: number;
  deleted_at: string | null;
};
export const quoteItemSchema = z
  .object({
    service_id: z.union([z.literal(""), z.uuid()]),
    business_line_id: z.uuid(),
    name: z.string().trim().min(2).max(160),
    description: z.string().max(10000),
    quantity: decimalInput.refine(
      (v) => Number(v) > 0,
      "La cantidad debe ser mayor a cero.",
    ),
    unit: z.enum(["m2", "unit", "hour", "visit", "fixed", "pct"]),
    unitPrice: moneyInput,
    discount: percentage,
  })
  .refine(
    (s) => s.unit !== "pct" || Number(s.unitPrice) <= 100,
    "El porcentaje de obra no puede superar 100.",
  );
export const quoteHeaderSchema = z.object({
  client_id: z.uuid("Selecciona un cliente."),
  name: z.string().trim().min(2, "Escribe el nombre del proyecto.").max(160),
  vat_rate: percentage,
  apply_vat: z.boolean(),
  advance_rate: percentage,
  valid_until: z.iso.date("Revisa la fecha de vigencia."),
  notes: z.string().max(10000),
  conditions: z.string().max(20000),
  estimated_hours: decimalInput,
  externalCost: moneyInput,
});
export const quoteSchema = z.object({
  header: quoteHeaderSchema,
  items: z
    .array(quoteItemSchema)
    .min(1, "Agrega al menos una partida.")
    .max(100),
});
export type QuoteItem = z.infer<typeof quoteItemSchema>;
export type QuoteHeader = z.infer<typeof quoteHeaderSchema>;
