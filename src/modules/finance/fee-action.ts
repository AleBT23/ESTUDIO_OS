"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireContext } from "@/shared/auth/context";
import { canReadFinance } from "@/shared/permissions";
import { toCents } from "@/shared/money";
import type { RecordState } from "@/shared/ui/record-form";
const schema = z
  .object({
    id: z.uuid(),
    project_id: z.uuid(),
    member_id: z.uuid(),
    package_id: z.union([z.uuid(), z.literal("")]).transform((v) => v || null),
    label: z.string().trim().min(2).max(145),
    mode: z.enum(["fixed", "percent"]),
    value: z
      .string()
      .regex(/^\d{1,12}(\.\d{1,2})?$/)
      .transform(toCents)
      .refine((v) => v > 0),
  })
  .refine((p) => p.mode === "fixed" || (!!p.package_id && p.value <= 10000));
export async function saveFee(
  _prev: RecordState,
  data: FormData,
): Promise<RecordState> {
  const ctx = await requireContext();
  if (!canReadFinance(ctx.membership.role))
    return { error: "Permisos insuficientes." };
  const parsed = schema.safeParse(Object.fromEntries(data));
  if (!parsed.success)
    return {
      error:
        "Revisa el importe o el porcentaje y selecciona un paquete para los repartos porcentuales.",
    };
  const { value, mode, ...fields } = parsed.data;
  const { error } = await ctx.db
    .from("collaborator_fees")
    .insert({
      ...fields,
      organization_id: ctx.organization.id,
      [mode === "fixed" ? "fixed_cents" : "rate_bps"]: value,
    });
  if (error)
    return {
      error:
        "No se pudo registrar el honorario. Verifica el paquete, su importe contratado y el porcentaje disponible.",
    };
  revalidatePath("/proyectos/" + fields.project_id);
  revalidatePath("/administracion/operaciones");
  revalidatePath("/");
  return {
    success: "Honorario comprometido. Puedes registrar pagos desde el acuerdo.",
    nextId: crypto.randomUUID(),
  };
}
