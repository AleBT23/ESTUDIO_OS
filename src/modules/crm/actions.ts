"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireContext } from "@/shared/auth/context";
import { canManageCommercial } from "@/shared/permissions";
import type { FormState } from "@/shared/auth/actions";
import { clientSchema } from "./schema";
export async function saveClient(
  _previous: FormState,
  form: FormData,
): Promise<FormState> {
  const ctx = await requireContext();
  if (!canManageCommercial(ctx.membership.role))
    return { error: "Tu rol no permite modificar clientes." };
  const parsed = clientSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const id = form.get("id");
  if (id) {
    const version = z.coerce
      .number()
      .int()
      .positive()
      .safeParse(form.get("version"));
    if (!z.uuid().safeParse(id).success || !version.success)
      return { error: "La referencia del cliente no es válida." };
    const { data, error } = await ctx.db
      .from("clients")
      .update(parsed.data)
      .eq("organization_id", ctx.organization.id)
      .eq("id", id)
      .eq("version", version.data)
      .is("deleted_at", null)
      .select("id")
      .maybeSingle();
    if (error)
      return {
        error:
          "No se pudo guardar. Revisa la conexión y la línea de negocio seleccionada.",
      };
    if (!data)
      return {
        error:
          "Este cliente cambió desde que lo abriste. Copia tus cambios y vuelve a abrir su ficha antes de guardar.",
      };
  } else {
    const { data, error } = await ctx.db
      .from("clients")
      .insert({ ...parsed.data, organization_id: ctx.organization.id })
      .select("id")
      .single();
    if (error)
      return {
        error:
          "No se pudo guardar el cliente. Revisa la conexión y vuelve a intentarlo.",
      };
    revalidatePath("/comercial");
    redirect(`/comercial/clientes/${data.id}`);
  }
  revalidatePath("/comercial");
  revalidatePath(`/comercial/clientes/${id}`);
  redirect(`/comercial/clientes/${id}`);
}
export async function archiveClient(
  _previous: FormState,
  form: FormData,
): Promise<FormState> {
  const ctx = await requireContext();
  if (!canManageCommercial(ctx.membership.role))
    return { error: "Tu rol no permite archivar clientes." };
  const parsed = z
    .object({
      id: z.uuid(),
      version: z.coerce.number().int().positive(),
      intent: z.enum(["archive", "restore"]),
    })
    .safeParse(Object.fromEntries(form));
  if (!parsed.success)
    return {
      error: "Referencia inválida. Recarga la ficha e intenta de nuevo.",
    };
  const { id, version, intent } = parsed.data;
  const { data, error } = await ctx.db
    .from("clients")
    .update({
      deleted_at: intent === "archive" ? new Date().toISOString() : null,
    })
    .eq("organization_id", ctx.organization.id)
    .eq("id", id)
    .eq("version", version)
    .select("id")
    .maybeSingle();
  if (error)
    return { error: "No pudimos actualizar el cliente. Intenta de nuevo." };
  if (!data)
    return { error: "El cliente cambió. Recarga la ficha antes de continuar." };
  revalidatePath("/comercial");
  revalidatePath(`/comercial/clientes/${id}`);
  return {
    success:
      intent === "archive"
        ? "Cliente archivado. Puedes restaurarlo desde esta ficha."
        : "Cliente restaurado.",
  };
}
