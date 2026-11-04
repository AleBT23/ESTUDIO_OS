"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireContext } from "@/shared/auth/context";
import { canWriteProject } from "@/shared/permissions";
import type { RecordState } from "@/shared/ui/record-form";
export async function saveDependency(
  _: RecordState,
  form: FormData,
): Promise<RecordState> {
  const ctx = await requireContext();
  const p = z
    .object({
      id: z.uuid(),
      project: z.uuid(),
      version: z.coerce.number().int().positive(),
      previous: z.union([z.uuid(), z.literal("")]),
    })
    .safeParse(Object.fromEntries(form));
  if (!p.success || !canWriteProject(ctx.membership.role))
    return { error: "Revisa la tarea y los permisos." };
  const { id, project, version, previous } = p.data;
  const r = await ctx.db
    .from("project_notes")
    .update({ predecessor_id: previous || null })
    .eq("organization_id", ctx.organization.id)
    .eq("project_id", project)
    .eq("id", id)
    .eq("version", version)
    .is("completed_at", null)
    .is("deleted_at", null)
    .select("id")
    .maybeSingle();
  if (r.error || !r.data)
    return {
      error: r.error?.message.includes("ciclo")
        ? "Las tareas no pueden depender entre sí en un ciclo."
        : "La tarea cambió o la dependencia no está disponible.",
    };
  revalidatePath("/proyectos/" + project);
  revalidatePath("/agenda");
  return { success: "Dependencia guardada." };
}
