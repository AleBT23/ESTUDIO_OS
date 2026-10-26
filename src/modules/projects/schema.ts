import { z } from "zod";
import { toCents } from "@/shared/money";
export const noteSchema = z.object({
  project: z.uuid(),
  body: z.string().trim().min(1, "Escribe la nota o pendiente.").max(10000),
  kind: z.enum(["task", "note"]),
  due_on: z.union([z.literal(""), z.iso.date()]),
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
};
