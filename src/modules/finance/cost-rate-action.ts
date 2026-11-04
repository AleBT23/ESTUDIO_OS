"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireContext } from "@/shared/auth/context";
import { canReadFinance } from "@/shared/permissions";
import { moneyInput } from "@/modules/quotes/schema";
import { toCents } from "@/shared/money";
import type { RecordState } from "@/shared/ui/record-form";
export async function saveCostRate(
  _previous: RecordState,
  form: FormData,
): Promise<RecordState> {
  const ctx = await requireContext();
  if (!canReadFinance(ctx.membership.role))
    return { error: "Permisos insuficientes." };
  const input = z
    .object({
      id: z.uuid(),
      member_id: z.uuid(),
      effective_on: z.iso.date(),
      hourly_cents: moneyInput.transform(toCents),
    })
    .safeParse(Object.fromEntries(form));
  if (!input.success)
    return { error: "Revisa el miembro, la fecha y el importe." };
  const result = await ctx.db
    .from("member_cost_rates")
    .insert({ ...input.data, organization_id: ctx.organization.id });
  if (result.error)
    return {
      error:
        result.error.code === "23505"
          ? "Ya existe una tarifa para esta vigencia o la solicitud ya se registró."
          : "No se pudo registrar la tarifa.",
    };
  revalidatePath("/administracion", "layout");
  revalidatePath("/proyectos", "layout");
  return { success: "Tarifa registrada.", nextId: crypto.randomUUID() };
}
