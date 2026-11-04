"use server";
import { requireContext } from "@/shared/auth/context";
import { canManageCommercial, canWriteProject } from "@/shared/permissions";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import type { RecordState } from "@/shared/ui/record-form";
const identity = z.object({
  id: z.uuid(),
  scope: z.enum(["client", "project"]),
  parent: z.uuid(),
});
export async function saveDossierFile(
  _prev: RecordState,
  form: FormData,
): Promise<RecordState> {
  const ctx = await requireContext();
  const v = identity
    .extend({
      title: z.string().trim().min(2).max(160),
      url: z.union([z.url({ protocol: /^https?$/ }).max(2048), z.literal("")]),
    })
    .safeParse(Object.fromEntries(form));
  if (!v.success) return { error: "Revisa el nombre y el enlace." };
  const { id, scope, parent, title, url } = v.data;
  if (
    !(scope === "client" ? canManageCommercial : canWriteProject)(
      ctx.membership.role,
    )
  )
    return { error: "Permisos insuficientes." };
  const file = form.get("file"),
    upload = file instanceof File && file.size > 0;
  if (
    (!url && !upload) ||
    (upload && (file.size > 2097152 || file.name.length > 200))
  )
    return {
      error:
        "Incluye un enlace o un archivo de hasta 2 MiB con nombre de hasta 200 caracteres.",
    };
  const { error } = await ctx.db
    .from("dossier_files")
    .insert({
      id,
      organization_id: ctx.organization.id,
      [scope === "client" ? "client_id" : "project_id"]: parent,
      title,
      url,
      filename: upload ? file.name : "",
      attachment: upload
        ? "\\x" + Buffer.from(await file.arrayBuffer()).toString("hex")
        : null,
    });
  if (error)
    return {
      error: "No se pudo guardar. Comprueba que el expediente siga vigente.",
    };
  revalidatePath(
    (scope === "client" ? "/comercial/clientes/" : "/proyectos/") + parent,
  );
  return { success: "Guardado en el expediente.", nextId: crypto.randomUUID() };
}
export async function archiveDossierFile(
  _prev: RecordState,
  form: FormData,
): Promise<RecordState> {
  const ctx = await requireContext();
  const v = identity
    .extend({
      version: z.coerce.number().int().positive(),
      intent: z.enum(["archive", "restore"]),
    })
    .safeParse(Object.fromEntries(form));
  if (!v.success || !canManageCommercial(ctx.membership.role))
    return { error: "Permisos o referencia inválidos." };
  const { scope, parent, id, version, intent } = v.data;
  let query = ctx.db
    .from("dossier_files")
    .update({
      deleted_at: intent === "archive" ? new Date().toISOString() : null,
    })
    .eq("organization_id", ctx.organization.id)
    .eq(scope === "client" ? "client_id" : "project_id", parent)
    .eq("id", id)
    .eq("version", version);
  query =
    intent === "archive"
      ? query.is("deleted_at", null)
      : query.not("deleted_at", "is", null);
  const result = await query.select("id").maybeSingle();
  if (result.error || !result.data)
    return { error: "El archivo cambió. Actualiza la lista." };
  revalidatePath(
    (scope === "client" ? "/comercial/clientes/" : "/proyectos/") + parent,
  );
  return { success: "Expediente actualizado." };
}
