"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireContext } from "@/shared/auth/context";
import { canManageCommercial, canWriteProject } from "@/shared/permissions";
import type { RecordState } from "@/shared/ui/record-form";
export async function savePhaseTemplate(
  _: RecordState,
  form: FormData,
): Promise<RecordState> {
  const ctx = await requireContext();
  const p = z
    .object({
      id: z.uuid(),
      version: z.coerce.number().int().nonnegative(),
      name: z.string().trim().min(2).max(160),
      tasks: z
        .string()
        .max(41000)
        .transform((s) =>
          s
            .split(/\r?\n/)
            .map((v) => v.trim())
            .filter(Boolean),
        )
        .pipe(z.array(z.string().max(400)).max(100))
        .optional(),
      phases: z
        .string()
        .max(41000)
        .transform((s) =>
          s
            .split(/\r?\n/)
            .map((v) => v.trim())
            .filter(Boolean),
        )
        .pipe(z.array(z.string().max(400)).min(1).max(100)),
    })
    .safeParse(Object.fromEntries(form));
  if (!p.success || !canManageCommercial(ctx.membership.role))
    return { error: "Revisa el nombre, las fases y los permisos." };
  const { id, version, ...fields } = p.data,
    table = ctx.db.from("phase_templates"),
    org = ctx.organization.id;
  const [line, service] = String(form.get("scope") || "").split("/");
  if (
    !version &&
    (!z.uuid().safeParse(line).success ||
      (service && !z.uuid().safeParse(service).success))
  )
    return { error: "Selecciona una línea o servicio." };
  const q = version
    ? table
        .update(fields)
        .eq("organization_id", org)
        .eq("id", id)
        .eq("version", version)
    : table.insert({
        ...fields,
        id,
        organization_id: org,
        business_line_id: line,
        service_id: service || null,
      });
  const result = await q.select("id").maybeSingle();
  if (result.error || !result.data)
    return { error: "No se pudo guardar la plantilla. Revisa su versión." };
  revalidatePath("/proyectos/[id]", "page");
  return {
    success: "Plantilla guardada.",
    ...(!version && { nextId: crypto.randomUUID() }),
  };
}
export async function applyPhasePlan(
  _: RecordState,
  form: FormData,
): Promise<RecordState> {
  const ctx = await requireContext(),
    p = z
      .object({
        id: z.uuid(),
        project_id: z.uuid(),
        template_id: z.uuid(),
        template_version: z.coerce.number().int().positive(),
      })
      .safeParse(Object.fromEntries(form));
  if (!p.success || !canWriteProject(ctx.membership.role))
    return { error: "Revisa los datos y permisos." };
  const { error } = await ctx.db
    .from("project_phase_plans")
    .insert({ ...p.data, organization_id: ctx.organization.id });
  if (error)
    return {
      error:
        "No se pudo aplicar la plantilla. Revisa si ya existe el plan o cambió la versión.",
    };
  revalidatePath("/proyectos/" + p.data.project_id);
  return { success: "Plan de fases creado." };
}
export async function movePhase(
  _: RecordState,
  form: FormData,
): Promise<RecordState> {
  const ctx = await requireContext(),
    p = z
      .object({
        id: z.uuid(),
        project_id: z.uuid(),
        completed: z.coerce.number().int().nonnegative(),
        delta: z.enum(["1", "-1"]),
      })
      .safeParse(Object.fromEntries(form));
  if (!p.success || !canWriteProject(ctx.membership.role))
    return { error: "Sin acceso al plan." };
  const { id, project_id, completed, delta } = p.data;
  const r = await ctx.db
    .from("project_phase_plans")
    .update({ completed: completed + Number(delta) })
    .eq("id", id)
    .eq("organization_id", ctx.organization.id)
    .eq("project_id", project_id)
    .eq("completed", completed)
    .select("id")
    .maybeSingle();
  if (r.error || !r.data)
    return { error: "El avance cambió. Actualiza el expediente." };
  revalidatePath("/proyectos/" + project_id);
  return { success: "Avance actualizado." };
}
export async function setQuotePhaseDefault(
  _: RecordState,
  form: FormData,
): Promise<RecordState> {
  const ctx = await requireContext();
  const value = z
    .object({
      id: z.uuid(),
      version: z.coerce.number().int().positive(),
      enabled: z.enum(["true", "false"]),
    })
    .safeParse(Object.fromEntries(form));
  if (!value.success || !canManageCommercial(ctx.membership.role))
    return { error: "Referencia o permisos inválidos." };
  const { id, version, enabled } = value.data;
  const r = await ctx.db
    .from("phase_templates")
    .update({ on_quote_acceptance: enabled === "true" })
    .eq("organization_id", ctx.organization.id)
    .eq("id", id)
    .eq("version", version)
    .is("service_id", null)
    .select("id")
    .maybeSingle();
  if (r.error?.code === "23505")
    return {
      error: "Desactiva primero la plantilla automática de esta línea.",
    };
  if (r.error || !r.data)
    return { error: "No se pudo actualizar la plantilla. Revisa su versión." };
  revalidatePath("/proyectos/[id]", "page");
  return { success: "Preferencia de conversión guardada." };
}
