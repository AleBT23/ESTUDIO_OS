"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireContext } from "@/shared/auth/context";
import { canWriteProject } from "@/shared/permissions";
import type { RecordState } from "@/shared/ui/record-form";
const optional = z.union([z.uuid(), z.literal("")]).transform((v) => v || null);
const schema = z.object({
  id: z.uuid(),
  project_id: z.uuid(),
  package_id: optional,
  task_id: optional,
  worked_on: z.iso.date(),
  minutes: z.coerce.number().int().min(1).max(1440),
  description: z.string().trim().min(1).max(1000),
  version: z.coerce.number().int().positive().optional(),
});
export async function saveTime(
  _state: RecordState,
  form: FormData,
): Promise<RecordState> {
  const ctx = await requireContext();
  if (!canWriteProject(ctx.membership.role))
    return { error: "Permisos insuficientes." };
  const p = schema.safeParse(Object.fromEntries(form));
  if (!p.success)
    return { error: "Revisa la fecha, los minutos y la actividad." };
  const { id, project_id, version, ...fields } = p.data,
    org = ctx.organization.id;
  const result = version
    ? await ctx.db
        .from("project_time")
        .update(fields)
        .eq("organization_id", org)
        .eq("project_id", project_id)
        .eq("id", id)
        .eq("version", version)
        .select("id")
        .single()
    : await ctx.db
        .from("project_time")
        .insert({ id, organization_id: org, project_id, ...fields });
  if (result.error)
    return {
      error: "No se pudo guardar. Actualiza el historial antes de reintentar.",
    };
  revalidatePath("/proyectos/" + project_id);
  return {
    success: "Tiempo registrado.",
    ...(version ? {} : { nextId: crypto.randomUUID() }),
  };
}
