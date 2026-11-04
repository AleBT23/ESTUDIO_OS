"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireContext } from "@/shared/auth/context";
import { canReadFinance } from "@/shared/permissions";
import { toCents } from "@/shared/money";
import type { OperationState } from "./operations-actions";
const schema = z.object({
  id: z.uuid(),
  work_id: z.uuid(),
  chapter: z.string().trim().min(1).max(100),
  description: z.string().trim().min(2).max(300),
  unit: z.string().trim().min(1).max(25),
  quantity: z
    .string()
    .regex(/^\d{1,8}(\.\d{1,4})?$/)
    .refine((s) => Number(s) > 0),
  unit_price_cents: z
    .string()
    .regex(/^\d{1,10}(\.\d{1,2})?$/)
    .transform(toCents),
});
export async function saveBudgetItem(
  _prev: OperationState,
  form: FormData,
): Promise<OperationState> {
  const ctx = await requireContext();
  if (!canReadFinance(ctx.membership.role))
    return { error: "Permisos insuficientes." };
  const result = schema.safeParse(Object.fromEntries(form));
  if (!result.success)
    return { error: "Revisa capítulo, concepto, cantidad y precio unitario." };
  const { error } = await ctx.db
    .from("work_budget_items")
    .insert({ ...result.data, organization_id: ctx.organization.id });
  if (error)
    return {
      error:
        "No se pudo guardar la partida. Verifica el presupuesto antes de reintentar.",
    };
  revalidatePath("/obras");
  return { success: "Partida registrada.", nextId: crypto.randomUUID() };
}
