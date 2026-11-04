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
const supplierInput = z.object({
  id: z.uuid(),
  name: z.string().trim().min(2).max(160),
  kind: z.enum(["supplier", "subcontractor"]),
  contact: z.string().trim().max(300),
});
const caseInput = base
  .extend({
    area: z.enum(["architecture", "construction", "service"]),
    work_id: optionalId,
    supplier_id: optionalId.optional(),
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
  kind: "work" | "case" | "entry" | "supplier",
  _prev: OperationState,
  form: FormData,
): Promise<OperationState> {
  const ctx = await requireContext();
  if (!canReadFinance(ctx.membership.role))
    return { error: "Permisos insuficientes." };
  const schema =
    kind === "supplier"
      ? supplierInput
      : kind === "work"
        ? base
        : kind === "case"
          ? caseInput
          : entryInput;
  const input = schema.safeParse(Object.fromEntries(form));
  if (!input.success)
    return {
      error: "Revisa los importes, los vínculos y el origen de los fondos.",
    };
  const table =
    kind === "supplier"
      ? "suppliers"
      : kind === "work"
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
  revalidatePath("/administracion/proveedores");
  revalidatePath("/obras");
  revalidatePath("/");
  revalidatePath("/administracion/operaciones", "layout");
  return { success: "Registro guardado.", nextId: crypto.randomUUID() };
}

export async function reverseEntry(
  _prev: OperationState,
  form: FormData,
): Promise<OperationState> {
  const ctx = await requireContext();
  if (!canReadFinance(ctx.membership.role))
    return { error: "Permisos insuficientes." };
  const input = z
    .object({ id: z.uuid(), reason: z.string().trim().min(3).max(500) })
    .safeParse(Object.fromEntries(form));
  if (!input.success)
    return { error: "Indica el movimiento y el motivo de la corrección." };
  const result = await ctx.db
    .from("finance_entries")
    .update({ reversal_reason: input.data.reason })
    .eq("organization_id", ctx.organization.id)
    .eq("id", input.data.id)
    .is("reversed_at", null)
    .select("id")
    .maybeSingle();
  if (result.error || !result.data)
    return {
      error:
        "No se pudo revertir. Actualiza el historial y verifica el estado.",
    };
  revalidatePath("/");
  revalidatePath("/administracion/proveedores");
  revalidatePath("/obras");
  revalidatePath("/administracion/operaciones", "layout");
  return { success: "Movimiento revertido." };
}
