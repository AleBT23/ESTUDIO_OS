"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireContext } from "@/shared/auth/context";
import { canReadFinance } from "@/shared/permissions";
import type { RecordState } from "@/shared/ui/record-form";
const usage = z.object({
  id: z.uuid(),
  work_id: z.uuid(),
  item_id: z.uuid(),
  category: z.enum(["material", "labor", "equipment"]),
  description: z.string().trim().min(2).max(200),
  used_on: z.iso.date(),
  quantity: z
    .string()
    .regex(/^\d{1,8}(\.\d{1,4})?$/)
    .refine((v) => Number(v) > 0),
  unit: z.string().trim().min(1).max(30),
  supplier_id: z.union([z.uuid(), z.literal("")]).transform((s) => s || null),
});
export async function saveUsage(
  _state: RecordState,
  form: FormData,
): Promise<RecordState> {
  const ctx = await requireContext();
  if (!canReadFinance(ctx.membership.role))
    return { error: "Permisos insuficientes." };
  const parsed = usage.safeParse(Object.fromEntries(form));
  if (!parsed.success)
    return { error: "Revisa los datos del consumo y la unidad de medida." };
  const { error } = await ctx.db
    .from("work_resource_usage")
    .insert({ ...parsed.data, organization_id: ctx.organization.id });
  if (error)
    return {
      error:
        "No se pudo registrar el consumo. Comprueba el historial antes de reintentar.",
    };
  revalidatePath("/obras/partidas/" + parsed.data.item_id);
  return { success: "Consumo registrado.", nextId: crypto.randomUUID() };
}
