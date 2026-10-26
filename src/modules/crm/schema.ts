import { z } from "zod";
export const clientSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Escribe un nombre de al menos 2 caracteres.")
    .max(160),
  kind: z.enum(["person", "company"]),
  email: z
    .union([z.literal(""), z.email("Revisa el correo electrónico.")])
    .default(""),
  phone: z.string().trim().max(40).default(""),
  address: z.string().trim().max(500).default(""),
  source: z.string().trim().max(120).default(""),
  notes: z.string().trim().max(10000).default(""),
  business_line_id: z
    .union([z.uuid(), z.literal("")])
    .transform((value) => value || null),
});
export type ClientInput = z.input<typeof clientSchema>;
export type Client = z.output<typeof clientSchema> & {
  id: string;
  version: number;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
};
