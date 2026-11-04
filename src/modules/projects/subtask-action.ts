"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireContext } from "@/shared/auth/context";
import { canWriteProject } from "@/shared/permissions";
import type { RecordState } from "@/shared/ui/record-form";
async function taskContext(project: string, task: string) {
  const ctx = await requireContext();
  if (!canWriteProject(ctx.membership.role))
    throw Error("Permisos insuficientes.");
  const r = await ctx.db
    .from("project_notes_context")
    .select("id")
    .eq("organization_id", ctx.organization.id)
    .eq("project_id", project)
    .eq("id", task)
    .eq("kind", "task")
    .is("deleted_at", null)
    .is("completed_at", null)
    .maybeSingle();
  if (r.error || !r.data) throw Error("La tarea ya no está abierta.");
  return ctx;
}
export async function addSubtask(
  project: string,
  task: string,
  _prev: RecordState,
  form: FormData,
): Promise<RecordState> {
  const p = z
    .object({ id: z.uuid(), label: z.string().trim().min(1).max(400) })
    .safeParse(Object.fromEntries(form));
  if (!p.success) return { error: "Revisa la descripción de la subtarea." };
  const ctx = await taskContext(project, task);
  const r = await ctx.db
    .from("task_subtasks")
    .insert({ ...p.data, organization_id: ctx.organization.id, task_id: task });
  if (r.error)
    return { error: "No se pudo añadir la subtarea. Actualiza el expediente." };
  revalidatePath("/proyectos/" + project);
  return { success: "Subtarea añadida.", nextId: crypto.randomUUID() };
}
export async function saveSubtask(
  project: string,
  task: string,
  id: string,
  done: boolean,
) {
  const ctx = await taskContext(project, task);
  const r = await ctx.db
    .from("task_subtasks")
    .update({ done })
    .eq("organization_id", ctx.organization.id)
    .eq("task_id", task)
    .eq("id", id);
  if (r.error) throw Error("No se pudo actualizar la subtarea.");
  revalidatePath("/proyectos/" + project);
}
