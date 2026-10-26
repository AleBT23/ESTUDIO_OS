"use server";
import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireContext } from "@/shared/auth/context";
import { canWriteProject, canReadFinance } from "@/shared/permissions";
import type { FormState } from "@/shared/auth/actions";
import { noteSchema, projectSchema, cents } from "./schema";
const refresh = (id: string) => {
  revalidatePath("/");
  revalidatePath(`/proyectos/${id}`);
  revalidatePath("/proyectos");
};
export async function saveProjectNote(
  _: FormState,
  form: FormData,
): Promise<FormState> {
  const ctx = await requireContext();
  if (!canWriteProject(ctx.membership.role))
    return { error: "Tu rol solo permite consultar el expediente." };
  const input = noteSchema.safeParse(Object.fromEntries(form));
  if (!input.success) return { error: input.error.issues[0].message };
  const { project, ...fields } = input.data;
  const record = { ...fields, due_on: fields.due_on || null };
  const id = form.get("id");
  if (id) {
    const identity = z
      .object({ id: z.uuid(), version: z.coerce.number().int().positive() })
      .safeParse(Object.fromEntries(form));
    if (!identity.success)
      return { error: "Referencia inválida. Recarga el expediente." };
    const { data, error } = await ctx.db
      .from("project_notes")
      .update({ body: record.body, due_on: record.due_on })
      .eq("organization_id", ctx.organization.id)
      .eq("project_id", project)
      .eq("id", identity.data.id)
      .eq("version", identity.data.version)
      .is("deleted_at", null)
      .select("id")
      .maybeSingle();
    if (error || !data)
      return {
        error:
          "No se guardó: el pendiente pudo cambiar. Recarga antes de continuar.",
      };
  } else {
    const { error } = await ctx.db.from("project_notes").insert({
      ...record,
      organization_id: ctx.organization.id,
      project_id: project,
    });
    if (error)
      return {
        error: "No se pudo guardar la nota. Revisa el proyecto y la conexión.",
      };
  }
  refresh(project);
  return { success: "Nota guardada y compartida con tu estudio." };
}
export async function toggleProjectNote(
  _: FormState,
  form: FormData,
): Promise<FormState> {
  const ctx = await requireContext();
  if (!canWriteProject(ctx.membership.role))
    return { error: "Tu rol no permite completar pendientes." };
  const input = z
    .object({
      id: z.uuid(),
      project: z.uuid(),
      version: z.coerce.number().int().positive(),
      done: z.enum(["yes", "no"]),
    })
    .safeParse(Object.fromEntries(form));
  if (!input.success) return { error: "Referencia inválida." };
  const { data, error } = await ctx.db
    .from("project_notes")
    .update({
      completed_at: input.data.done === "yes" ? new Date().toISOString() : null,
    })
    .eq("organization_id", ctx.organization.id)
    .eq("project_id", input.data.project)
    .eq("id", input.data.id)
    .eq("version", input.data.version)
    .eq("kind", "task")
    .is("deleted_at", null)
    .select("id")
    .maybeSingle();
  if (error || !data)
    return { error: "El pendiente cambió. Recarga para ver su estado actual." };
  refresh(input.data.project);
  return {
    success:
      input.data.done === "yes"
        ? "Pendiente completado."
        : "Pendiente reabierto.",
  };
}
export async function createProject(
  _: FormState,
  form: FormData,
): Promise<FormState> {
  const ctx = await requireContext();
  if (!canReadFinance(ctx.membership.role))
    return { error: "Tu rol no permite crear proyectos ni definir importes." };
  const input = projectSchema.safeParse({
    ...Object.fromEntries(form),
    total: form.get("total") || "0",
  });
  if (!input.success)
    return { error: "Revisa cliente, nombre, fecha e importe." };
  const { data, error } = await ctx.db.rpc("create_project_record", {
    org: ctx.organization.id,
    client: input.data.client,
    project_name: input.data.name,
    start_on: input.data.start_on,
    total: cents(input.data.total),
    request_id: input.data.request_id,
  });
  if (error)
    return {
      error:
        "No se pudo crear el proyecto. Revisa el cliente y la conexión; no repitas si ya aparece en el listado.",
    };
  revalidatePath("/proyectos");
  redirect(`/proyectos/${data}`);
}
export async function defineProjectAmount(
  _: FormState,
  form: FormData,
): Promise<FormState> {
  const ctx = await requireContext();
  if (!canReadFinance(ctx.membership.role))
    return { error: "Permisos insuficientes." };
  const input = z
    .object({
      project: z.uuid(),
      version: z.coerce.number().int().positive(),
      total: z.string().regex(/^\d{1,12}(\.\d{1,2})?$/),
      due_on: z.iso.date(),
    })
    .safeParse(Object.fromEntries(form));
  if (!input.success)
    return { error: "Revisa el importe y la fecha prevista." };
  const { error } = await ctx.db.rpc("define_project_amount", {
    org: ctx.organization.id,
    project: input.data.project,
    expected_version: input.data.version,
    total: cents(input.data.total),
    due_on: input.data.due_on,
  });
  if (error)
    return {
      error:
        "No se guardó el importe: debe ser positivo y el proyecto no debe tener un plan previo. Recarga para comprobarlo.",
    };
  refresh(input.data.project);
  revalidatePath("/administracion");
  return {
    success:
      "Importe acordado registrado. Los cobros efectivos se registran por separado.",
  };
}
