"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireContext } from "@/shared/auth/context";
import { canManageCommercial } from "@/shared/permissions";
import type { RecordState } from "@/shared/ui/record-form";
export async function saveWorkPackage(
  _: RecordState,
  form: FormData,
): Promise<RecordState> {
  const ctx = await requireContext();
  if (!canManageCommercial(ctx.membership.role))
    return { error: "Permisos insuficientes." };
  const parsed = z
    .object({
      id: z.uuid(),
      project: z.uuid(),
      line: z.uuid(),
      version: z.coerce.number().int().nonnegative(),
      title: z.string().trim().min(2).max(160),
      instructions: z.string().max(6000),
    })
    .safeParse(Object.fromEntries(form));
  if (!parsed.success)
    return { error: "Revisa el nombre, la línea y las instrucciones." };
  const { id, project, line, version, title, instructions } = parsed.data;
  const { error } = await ctx.db.rpc("save_work_package", {
    org: ctx.organization.id,
    project,
    package: id,
    line,
    expected_version: version,
    title,
    instructions,
  });
  if (error)
    return {
      error:
        "No se guardó el paquete. Comprueba el estado del proyecto y si el paquete cambió desde que abriste la ficha.",
    };
  revalidatePath("/proyectos/" + project);
  return {
    success: "Paquete guardado.",
    ...(!version && { nextId: crypto.randomUUID() }),
  };
}
