import { z } from "zod";
import { toCents } from "@/shared/money";
export const noteSchema = z
  .object({
    project: z.uuid(),
    body: z.string().trim().min(1, "Escribe la nota o pendiente.").max(10000),
    kind: z.enum(["task", "note"]),
    priority: z.enum(["low", "normal", "high"]).default("normal"),
    repeat_days: z.coerce
      .number()
      .pipe(z.union([z.literal(0), z.literal(1), z.literal(7), z.literal(14)]))
      .default(0),
    assignee: z
      .union([z.uuid(), z.literal("")])
      .optional()
      .transform((v) => v || null),
    due_on: z.union([z.literal(""), z.iso.date()]),
  })
  .refine((v) => v.repeat_days === 0 || (v.kind === "task" && !!v.due_on), {
    message: "Indica una fecha para repetir el pendiente.",
  });
export const projectSchema = z.object({
  client: z.uuid(),
  name: z.string().trim().min(2).max(160),
  start_on: z.iso.date(),
  total: z
    .string()
    .regex(/^\d{1,12}(\.\d{1,2})?$/, "Revisa el importe en MXN."),
  request_id: z.uuid(),
});
export const cents = (amount: string) => toCents(amount);
export type ProjectNote = {
  id: string;
  project_id: string;
  body: string;
  kind: "task" | "note";
  due_on: string | null;
  completed_at: string | null;
  version: number;
  created_at: string;
  project_name?: string;
  priority?: "low" | "normal" | "high";
  repeat_days?: number;
  assignee?: string | null;
};
