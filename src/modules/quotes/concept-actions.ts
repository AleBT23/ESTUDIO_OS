"use server";
import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireContext } from "@/shared/auth/context";
import { canManageCommercial } from "@/shared/permissions";
import type { FormState } from "@/shared/auth/actions";
import { conceptSchema } from "./concept-schema";
export async function saveConcept(
  _previous: FormState,
  form: FormData,
): Promise<FormState> {
  const ctx = await requireContext();
  if (!canManageCommercial(ctx.membership.role))
    return { error: "Tu rol no permite modificar conceptos comerciales." };
  const input = conceptSchema.safeParse(Object.fromEntries(form));
  if (!input.success) return { error: input.error.issues[0].message };
  const id = form.get("id");
  let target: string;
  if (id) {
    const identity = z
      .object({ id: z.uuid(), version: z.coerce.number().int().positive() })
      .safeParse(Object.fromEntries(form));
    if (!identity.success) return { error: "Referencia de concepto inválida." };
    const { data, error } = await ctx.db
      .from("concepts")
      .update(input.data)
      .eq("organization_id", ctx.organization.id)
      .eq("id", identity.data.id)
      .eq("version", identity.data.version)
      .is("deleted_at", null)
      .select("id")
      .maybeSingle();
    if (error)
      return { error: "No se pudo guardar el concepto. Revisa la conexión." };
    if (!data)
      return {
        error:
          "El concepto cambió. Copia tu texto y vuelve a abrirlo antes de guardar.",
      };
    target = data.id;
  } else {
    const { data, error } = await ctx.db
      .from("concepts")
      .insert({ ...input.data, organization_id: ctx.organization.id })
      .select("id")
      .single();
    if (error)
      return { error: "No se pudo crear el concepto. Revisa la conexión." };
    target = data.id;
  }
  revalidatePath("/comercial/conceptos");
  redirect("/comercial/conceptos?selected=" + target);
}
export async function archiveConcept(
  _previous: FormState,
  form: FormData,
): Promise<FormState> {
  const ctx = await requireContext();
  if (!canManageCommercial(ctx.membership.role))
    return { error: "Permisos insuficientes." };
  const input = z
    .object({
      id: z.uuid(),
      version: z.coerce.number().int().positive(),
      intent: z.enum(["archive", "restore"]),
    })
    .safeParse(Object.fromEntries(form));
  if (!input.success)
    return { error: "Referencia inválida. Recarga el concepto." };
  const { data, error } = await ctx.db
    .from("concepts")
    .update({
      deleted_at:
        input.data.intent === "archive" ? new Date().toISOString() : null,
    })
    .eq("organization_id", ctx.organization.id)
    .eq("id", input.data.id)
    .eq("version", input.data.version)
    .select("id")
    .maybeSingle();
  if (error) return { error: "No se pudo actualizar el concepto." };
  if (!data)
    return { error: "El concepto cambió. Recarga antes de continuar." };
  revalidatePath("/comercial/conceptos");
  return {
    success:
      "Concepto actualizado. Las cotizaciones conservan el texto que ya copiaste.",
  };
}
