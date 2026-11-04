"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireContext } from "@/shared/auth/context";
import { canManageCommercial, canWriteProject } from "@/shared/permissions";
import type { RecordState } from "@/shared/ui/record-form";
const path = "/recursos/procedimientos";
const base = z.object({
  id: z.uuid(),
  name: z.string().trim().min(2).max(160),
});
function saved(): RecordState {
  revalidatePath(path);
  return { success: "Guardado.", nextId: crypto.randomUUID() };
}
export async function createProcedure(
  _: RecordState,
  form: FormData,
): Promise<RecordState> {
  const ctx = await requireContext();
  const p = base
    .extend({
      steps: z
        .string()
        .max(41000)
        .transform((s) =>
          s
            .split(/\r?\n/)
            .map((t) => t.trim())
            .filter(Boolean),
        )
        .pipe(z.array(z.string().max(400)).min(1).max(100)),
    })
    .safeParse(Object.fromEntries(form));
  if (!canManageCommercial(ctx.membership.role) || !p.success)
    return { error: "Revisa el nombre, los pasos y tus permisos." };
  const { error } = await ctx.db
    .from("studio_procedures")
    .insert({ ...p.data, organization_id: ctx.organization.id });
  return error ? { error: "No se pudo crear el procedimiento." } : saved();
}
export async function startProcedure(
  _: RecordState,
  form: FormData,
): Promise<RecordState> {
  const ctx = await requireContext();
  const p = base
    .extend({
      procedure_id: z.uuid(),
      project_id: z
        .union([z.literal(""), z.uuid()])
        .transform((s) => s || null),
    })
    .safeParse(Object.fromEntries(form));
  if (!canWriteProject(ctx.membership.role) || !p.success)
    return { error: "Revisa los datos de la lista." };
  const { error } = await ctx.db
    .from("procedure_runs")
    .insert({ ...p.data, organization_id: ctx.organization.id });
  return error ? { error: "No se pudo iniciar la lista." } : saved();
}
export async function setProcedureStep(form: FormData) {
  const ctx = await requireContext();
  const p = z
    .object({
      run_id: z.uuid(),
      step: z.coerce.number().int().min(1).max(100),
      done: z.enum(["yes", "no"]),
    })
    .parse(Object.fromEntries(form));
  if (!canWriteProject(ctx.membership.role))
    throw Error("Permisos insuficientes.");
  const row = {
    organization_id: ctx.organization.id,
    run_id: p.run_id,
    step: p.step,
  };
  const t = ctx.db.from("procedure_checks");
  const result =
    p.done === "yes" ? await t.insert(row) : await t.delete().match(row);
  if (result.error && !(p.done === "yes" && result.error.code === "23505"))
    throw Error("No se pudo actualizar el paso.");
  revalidatePath(path);
}
