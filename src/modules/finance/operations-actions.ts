"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireContext } from "@/shared/auth/context";
import { canReadFinance } from "@/shared/permissions";
import { toCents } from "@/shared/money";

const optionalId = z
  .union([z.uuid(), z.literal("")])
  .transform((v) => v || null);
const money = z
  .string()
  .regex(/^\d{1,12}(\.\d{1,2})?$/)
  .transform(toCents);
const base = z.object({
  id: z.uuid(),
  name: z.string().trim().min(2).max(160),
  client_id: optionalId,
  project_id: optionalId,
});
const caseInput = base
  .extend({
    area: z.enum(["architecture", "construction", "service"]),
    work_id: optionalId,
    provider: z
      .string()
      .trim()
      .max(160)
      .transform((v) => v || null),
    revenue_cents: money,
    cost_cents: money,
    managed: z.literal("on").optional().transform(Boolean),
  })
  .refine(
    (v) =>
      (!v.managed || v.area === "construction") &&
      (v.revenue_cents > 0 || v.cost_cents > 0),
  );
const entryInput = z.object({
  id: z.uuid(),
  case_id: z.uuid(),
  direction: z.enum(["in", "out"]),
  amount_cents: money.refine((v) => v > 0),
  paid_on: z.iso.date(),
  advance: z.literal("on").optional().transform(Boolean),
});
export type OperationState = {
  error?: string;
  success?: string;
  nextId?: string;
};
export async function saveOperation(
  kind: "work" | "case" | "entry",
  _prev: OperationState,
  form: FormData,
): Promise<OperationState> {
  const ctx = await requireContext();
  if (!canReadFinance(ctx.membership.role))
    return { error: "Permisos insuficientes." };
  const schema =
    kind === "work" ? base : kind === "case" ? caseInput : entryInput;
  const input = schema.safeParse(Object.fromEntries(form));
  if (!input.success)
    return {
      error: "Revisa los importes, los vínculos y el origen de los fondos.",
    };
  const table =
    kind === "work"
      ? "works"
      : kind === "case"
        ? "finance_cases"
        : "finance_entries";
  const { error } = await ctx.db
    .from(table)
    .insert({ ...input.data, organization_id: ctx.organization.id });
  if (error)
    return {
      error:
        kind === "entry"
          ? "No se registró el movimiento. Verifica el saldo, la fecha y si ya aparece en el historial."
          : "No se pudo guardar. Revisa los datos y si el registro ya existe.",
    };
  revalidatePath("/");
  revalidatePath("/administracion/operaciones", "layout");
  return { success: "Registro guardado.", nextId: crypto.randomUUID() };
}
