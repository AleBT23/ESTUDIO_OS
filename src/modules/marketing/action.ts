"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireContext } from "@/shared/auth/context";
import { canManageCommercial } from "@/shared/permissions";
import type { RecordState } from "@/shared/ui/record-form";
const optionalId = z
  .union([z.uuid(), z.literal("")])
  .transform((v) => v || null);
const fields = z
  .object({
    id: z.uuid(),
    version: z.coerce.number().int().nonnegative(),
    title: z.string().trim().min(2).max(160),
    channel: z.string().trim().min(1).max(80),
    status: z.enum(["idea", "scheduled", "published"]),
    publication_on: z
      .union([z.iso.date(), z.literal("")])
      .transform((v) => v || null),
    url: z.union([z.url({ protocol: /^https?$/ }).max(2048), z.literal("")]),
    results: z.string().trim().max(4000),
    portfolio: z
      .literal("on")
      .optional()
      .transform((v) => v === "on"),
    project_id: optionalId,
    opportunity_id: optionalId,
  })
  .refine((v) => v.status === "idea" || v.publication_on);
export async function saveEditorial(
  _prev: RecordState,
  form: FormData,
): Promise<RecordState> {
  const ctx = await requireContext();
  if (!canManageCommercial(ctx.membership.role))
    return { error: "Permisos insuficientes." };
  const parsed = fields.safeParse(Object.fromEntries(form));
  if (!parsed.success)
    return {
      error: "Revisa el título, el canal, el enlace y la fecha de publicación.",
    };
  const { id, version, ...values } = parsed.data;
  const table = ctx.db.from("editorial_items");
  const query = version
    ? table
        .update(values)
        .eq("organization_id", ctx.organization.id)
        .eq("id", id)
        .eq("version", version)
    : table.insert({ ...values, id, organization_id: ctx.organization.id });
  const result = await query.select("id").maybeSingle();
  if (result.error || !result.data)
    return {
      error:
        "No se pudo guardar. Actualiza la página y comprueba la versión y los vínculos.",
    };
  revalidatePath("/comercial/marketing");
  return {
    success: "Contenido guardado.",
    ...(!version && { nextId: crypto.randomUUID() }),
  };
}
