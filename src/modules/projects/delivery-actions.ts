"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireContext } from "@/shared/auth/context";
import { canWriteProject, canManageCommercial } from "@/shared/permissions";
import type { RecordState } from "@/shared/ui/record-form";
const base = z.object({ id: z.uuid(), project_id: z.uuid() });
const delivery = base.extend({
  stage: z.string().trim().min(1).max(120),
  name: z.string().trim().min(2).max(200),
  assignee: z.union([z.uuid(), z.literal("")]).transform((v) => v || null),
  due_on: z.iso.date(),
});
const revision = base.extend({
  deliverable_id: z.uuid(),
  revision: z.coerce.number().int().positive(),
  state: z.enum(["review", "approved", "changes"]),
  notes: z.string().trim().min(1).max(4000),
  resource_url: z
    .union([z.url({ protocol: /^https$/ }).max(2000), z.literal("")])
    .transform((v) => v || null),
});
export async function saveDelivery(
  kind: "delivery" | "revision",
  _state: RecordState,
  form: FormData,
): Promise<RecordState> {
  const ctx = await requireContext();
  if (!canWriteProject(ctx.membership.role))
    return { error: "Permisos insuficientes." };
  const input = (kind === "delivery" ? delivery : revision).safeParse(
    Object.fromEntries(form),
  );
  if (!input.success)
    return { error: "Revisa los campos del entregable y el enlace HTTPS." };
  if (
    "state" in input.data &&
    input.data.state !== "review" &&
    !canManageCommercial(ctx.membership.role)
  )
    return { error: "La aprobación requiere un administrador." };
  const { error } = await ctx.db
    .from(
      kind === "delivery" ? "project_deliverables" : "deliverable_revisions",
    )
    .insert({ ...input.data, organization_id: ctx.organization.id });
  if (error)
    return {
      error:
        "No se pudo guardar. Actualiza el expediente para revisar la última versión.",
    };
  revalidatePath("/proyectos/" + input.data.project_id);
  return { success: "Registro guardado.", nextId: crypto.randomUUID() };
}
