"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireContext } from "@/shared/auth/context";
import { canManageCommercial } from "@/shared/permissions";
import type { RecordState } from "@/shared/ui/record-form";
const schema = z.object({
  id: z.uuid(),
  client_id: z.uuid(),
  project_id: z.union([z.uuid(), z.literal("")]).transform((v) => v || null),
  reference: z.string().trim().min(1).max(100),
  title: z.string().trim().min(2).max(180),
  signed_on: z.iso.date(),
  scope: z.string().trim().min(1).max(12000),
  document_url: z
    .union([z.url({ protocol: /^https$/ }).max(2000), z.literal("")])
    .transform((v) => v || null),
});
export async function registerContract(
  _state: RecordState,
  form: FormData,
): Promise<RecordState> {
  const ctx = await requireContext();
  if (!canManageCommercial(ctx.membership.role))
    return { error: "Permisos insuficientes." };
  const input = schema.safeParse(Object.fromEntries(form));
  if (!input.success)
    return {
      error: "Revisa el cliente, la fecha, el alcance y el enlace HTTPS.",
    };
  const { error } = await ctx.db
    .from("contracts")
    .insert({ ...input.data, organization_id: ctx.organization.id });
  if (error)
    return {
      error:
        error.code === "23505"
          ? "El folio ya existe en el estudio."
          : "No se pudo registrar el contrato. Comprueba que el proyecto pertenezca al cliente seleccionado.",
    };
  revalidatePath("/comercial/contratos");
  return { success: "Contrato registrado.", nextId: crypto.randomUUID() };
}
