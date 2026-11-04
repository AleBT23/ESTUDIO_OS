"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireContext } from "@/shared/auth/context";
import { canManageCommercial } from "@/shared/permissions";
import type { RecordState } from "@/shared/ui/record-form";
const schema = z.object({
  id: z.uuid(),
  resource_id: z.union([z.uuid(), z.literal("")]),
  version: z.coerce.number().int().positive(),
  title: z.string().trim().min(2).max(160),
  tags: z.string().trim().max(300),
  notes: z.string().trim().max(8000),
  url: z.union([z.url({ protocol: /^https?$/ }).max(2048), z.literal("")]),
});
export async function saveLibraryRevision(
  _: RecordState,
  form: FormData,
): Promise<RecordState> {
  const ctx = await requireContext();
  if (!canManageCommercial(ctx.membership.role))
    return { error: "Permisos insuficientes." };
  const parsed = schema.safeParse(Object.fromEntries(form)),
    file = form.get("file");
  if (!parsed.success)
    return { error: "Revisa el título, las etiquetas y el enlace." };
  if (file instanceof File && (file.size > 2097152 || file.name.length > 200))
    return { error: "El archivo supera 2 MiB o su nombre es demasiado largo." };
  const hasFile = file instanceof File && file.size > 0;
  const { id, resource_id, ...fields } = parsed.data;
  const { error } = await ctx.db
    .from("library_revisions")
    .insert({
      id,
      resource_id: resource_id || id,
      organization_id: ctx.organization.id,
      ...fields,
      filename: hasFile ? file.name : "",
      attachment: hasFile
        ? "\\x" + Buffer.from(await file.arrayBuffer()).toString("hex")
        : null,
    });
  if (error)
    return {
      error:
        "No se pudo guardar. Actualiza la página para revisar la última versión.",
    };
  revalidatePath("/recursos/biblioteca");
  return { success: "Revisión guardada.", nextId: crypto.randomUUID() };
}
