"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireContext } from "@/shared/auth/context";
import { canManageCommercial } from "@/shared/permissions";
import type { FormState } from "@/shared/auth/actions";
const schema = z.object({
  client_id: z.uuid(),
  name: z.string().trim().min(2).max(160),
  email: z.union([z.literal(""), z.email().max(254)]),
  phone: z.string().trim().max(40),
  position: z.string().trim().max(120),
});
export async function saveContact(
  _previous: FormState,
  form: FormData,
): Promise<FormState> {
  const ctx = await requireContext();
  if (!canManageCommercial(ctx.membership.role))
    return { error: "Permisos insuficientes." };
  const input = schema.safeParse(Object.fromEntries(form));
  if (!input.success)
    return { error: "Revisa el nombre y los datos del contacto." };
  const client = await ctx.db
    .from("clients")
    .select("id")
    .eq("organization_id", ctx.organization.id)
    .eq("id", input.data.client_id)
    .is("deleted_at", null)
    .maybeSingle();
  if (client.error || !client.data)
    return { error: "El cliente no está disponible para editar contactos." };
  const id = form.get("id");
  if (id) {
    const identity = z
      .object({ id: z.uuid(), version: z.coerce.number().int().positive() })
      .safeParse(Object.fromEntries(form));
    if (!identity.success) return { error: "Referencia inválida." };
    const { client_id, ...fields } = input.data;
    const { data, error } = await ctx.db
      .from("client_contacts")
      .update(fields)
      .eq("organization_id", ctx.organization.id)
      .eq("client_id", client_id)
      .eq("id", identity.data.id)
      .eq("version", identity.data.version)
      .is("deleted_at", null)
      .select("id")
      .maybeSingle();
    if (error) return { error: "No se pudo guardar el contacto." };
    if (!data)
      return { error: "El contacto cambió. Recarga antes de guardar." };
  } else {
    const { error } = await ctx.db
      .from("client_contacts")
      .insert({ ...input.data, organization_id: ctx.organization.id });
    if (error) return { error: "No se pudo crear el contacto." };
  }
  revalidatePath("/comercial/clientes/" + input.data.client_id);
  return { success: "Contacto guardado." };
}
export async function archiveContact(
  _previous: FormState,
  form: FormData,
): Promise<FormState> {
  const ctx = await requireContext();
  if (!canManageCommercial(ctx.membership.role))
    return { error: "Permisos insuficientes." };
  const input = z
    .object({
      id: z.uuid(),
      client_id: z.uuid(),
      version: z.coerce.number().int().positive(),
      intent: z.enum(["archive", "restore"]),
    })
    .safeParse(Object.fromEntries(form));
  if (!input.success) return { error: "Referencia inválida." };
  const { data, error } = await ctx.db
    .from("client_contacts")
    .update({
      deleted_at:
        input.data.intent === "archive" ? new Date().toISOString() : null,
    })
    .eq("organization_id", ctx.organization.id)
    .eq("client_id", input.data.client_id)
    .eq("id", input.data.id)
    .eq("version", input.data.version)
    .select("id")
    .maybeSingle();
  if (error) return { error: "No se pudo actualizar el contacto." };
  if (!data)
    return { error: "El contacto cambió. Recarga antes de continuar." };
  revalidatePath("/comercial/clientes/" + input.data.client_id);
  return { success: "Contacto actualizado." };
}
