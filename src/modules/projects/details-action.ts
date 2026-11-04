"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import type { RecordState } from "@/shared/ui/record-form";
import { requireContext } from "@/shared/auth/context";
import { canManageCommercial } from "@/shared/permissions";
export async function editProjectDetails(
  _previous: RecordState,
  form: FormData,
): Promise<RecordState> {
  const ctx = await requireContext();
  if (!canManageCommercial(ctx.membership.role))
    return { error: "Permisos insuficientes." };
  const data = z
    .object({
      id: z.uuid(),
      version: z.coerce.number().int().positive(),
      title: z.string().trim().min(2).max(200),
      site: z.string().trim().max(500),
      start_on: z.iso.date(),
      end_on: z.union([z.iso.date(), z.literal("")]),
      lead: z.union([z.uuid(), z.literal("")]),
      project_state: z.enum(["active", "paused", "closed", "archived"]),
    })
    .safeParse(Object.fromEntries(form));
  if (!data.success)
    return { error: "Revisa el nombre, las fechas y el responsable." };
  const { id, version, title, site, start_on, end_on, lead, project_state } =
    data.data;
  if (end_on && end_on < start_on)
    return { error: "El cierre debe ser igual o posterior al inicio." };
  const { error } = await ctx.db.rpc("edit_project_details", {
    org: ctx.organization.id,
    project: id,
    expected_version: version,
    title,
    site,
    start_on,
    end_on: end_on || null,
    lead: lead || null,
    project_state,
  });
  if (error)
    return {
      error:
        "No se guardaron los cambios. Actualiza el expediente y comprueba el responsable.",
    };
  revalidatePath("/proyectos", "layout");
  revalidatePath("/agenda", "layout");
  revalidatePath("/");
  return { success: "Expediente actualizado." };
}
