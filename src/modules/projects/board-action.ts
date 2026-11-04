"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireContext } from "@/shared/auth/context";
import { canWriteProject } from "@/shared/permissions";
import type { RecordState } from "@/shared/ui/record-form";
export async function moveTask(
  _: RecordState,
  form: FormData,
): Promise<RecordState> {
  const ctx = await requireContext(),
    p = z
      .object({
        id: z.uuid(),
        project: z.uuid(),
        version: z.coerce.number().int().positive(),
        lane: z.enum(["pending", "working", "done"]),
      })
      .safeParse(Object.fromEntries(form));
  if (!p.success || !canWriteProject(ctx.membership.role))
    return { error: "Revisa la tarea y los permisos." };
  const { id, project, version, lane } = p.data;
  const r = await ctx.db
    .from("project_notes")
    .update({
      in_progress: lane === "working",
      completed_at: lane === "done" ? new Date().toISOString() : null,
    })
    .eq("organization_id", ctx.organization.id)
    .eq("id", id)
    .eq("project_id", project)
    .eq("version", version)
    .eq("kind", "task")
    .is("deleted_at", null)
    .select("id")
    .maybeSingle();
  if (r.error || !r.data) {
    const reason = r.error?.message ?? "";
    if (
      reason.includes("Completa las subtareas") ||
      reason.includes("Completa primero la tarea previa") ||
      reason.includes("Reabre primero las tareas dependientes")
    )
      return { error: reason };
    return {
      error: "La tarea cambió o no está disponible. Actualiza el tablero.",
    };
  }
  revalidatePath("/agenda");
  revalidatePath("/");
  revalidatePath("/proyectos/" + project);
  return { success: "Tarea actualizada." };
}
