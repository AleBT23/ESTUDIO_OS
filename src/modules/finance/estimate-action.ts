"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireContext } from "@/shared/auth/context";
import { canReadFinance } from "@/shared/permissions";
import type { RecordState } from "@/shared/ui/record-form";
const input = z.object({
  id: z.uuid(),
  work_id: z.uuid(),
  item_id: z.uuid(),
  measured_on: z.iso.date(),
  quantity: z
    .string()
    .regex(/^\d{1,8}(\.\d{1,4})?$/)
    .refine((s) => Number(s) > 0),
  notes: z.string().trim().max(2000),
});
export async function saveEstimate(
  _prev: RecordState,
  data: FormData,
): Promise<RecordState> {
  const ctx = await requireContext();
  if (!canReadFinance(ctx.membership.role))
    return { error: "Permisos insuficientes." };
  const parsed = input.safeParse(Object.fromEntries(data));
  if (!parsed.success)
    return { error: "Revisa la fecha y la cantidad medida." };
  const { error } = await ctx.db
    .from("work_estimates")
    .insert({ ...parsed.data, organization_id: ctx.organization.id });
  if (error)
    return {
      error:
        "No se pudo registrar la estimación. Comprueba la cantidad pendiente y el historial.",
    };
  revalidatePath("/obras");
  revalidatePath("/obras/partidas/" + parsed.data.item_id);
  return { success: "Estimación registrada.", nextId: crypto.randomUUID() };
}
