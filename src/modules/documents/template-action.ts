"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireContext } from "@/shared/auth/context";
import { canManageCommercial } from "@/shared/permissions";
import type { RecordState } from "@/shared/ui/record-form";
const schema = z.object({
  id: z.uuid(),
  source_id: z.uuid(),
  source_version: z.coerce.number().int().positive(),
  name: z.string().trim().min(2).max(160),
  version: z.coerce.number().int().positive(),
});
export async function storeTemplate(
  _state: RecordState,
  data: FormData,
): Promise<RecordState> {
  const ctx = await requireContext();
  if (!canManageCommercial(ctx.membership.role))
    return { error: "Permisos insuficientes." };
  const values = Object.fromEntries(data);
  if (values.base_id) {
    if (!z.uuid().safeParse(values.base_id).success)
      return { error: "Plantilla inválida." };
    const base = await ctx.db
      .from("document_templates")
      .select("name,version")
      .eq("organization_id", ctx.organization.id)
      .eq("id", values.base_id)
      .maybeSingle();
    if (base.error || !base.data)
      return { error: "Versión de plantilla no disponible." };
    values.name = base.data.name;
    values.version = String(base.data.version + 1);
  }
  const p = schema.safeParse(values);
  if (!p.success)
    return {
      error: "Revisa el nombre de la plantilla y el documento de origen.",
    };
  const { error } = await ctx.db
    .from("document_templates")
    .insert({ ...p.data, organization_id: ctx.organization.id });
  if (error)
    return {
      error:
        "No se pudo guardar la versión. Actualiza el documento y comprueba si la plantilla ya existe.",
    };
  revalidatePath("/recursos/plantillas");
  revalidatePath("/recursos/documentos");
  return {
    success: "Versión de plantilla guardada.",
    nextId: crypto.randomUUID(),
  };
}
