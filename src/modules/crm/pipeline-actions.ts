"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireContext } from "@/shared/auth/context";
import { canManageCommercial } from "@/shared/permissions";
import type { FormState } from "@/shared/auth/actions";
import { opportunitySchema } from "./pipeline-schema";
export async function saveOpportunity(
  _previous: FormState,
  form: FormData,
): Promise<FormState> {
  const ctx = await requireContext();
  if (!canManageCommercial(ctx.membership.role))
    return { error: "Tu rol no permite modificar oportunidades." };
  const input = opportunitySchema.safeParse(Object.fromEntries(form));
  if (!input.success)
    return { error: "Revisa nombre, cliente, línea y fecha de seguimiento." };
  const id = form.get("id");
  let target: string;
  if (id) {
    const identity = z
      .object({ id: z.uuid(), version: z.coerce.number().int().positive() })
      .safeParse(Object.fromEntries(form));
    if (!identity.success) return { error: "Referencia inválida." };
    const { data, error } = await ctx.db
      .from("opportunities")
      .update(input.data)
      .eq("organization_id", ctx.organization.id)
      .eq("id", identity.data.id)
      .eq("version", identity.data.version)
      .is("deleted_at", null)
      .select("id")
      .maybeSingle();
    if (error) return { error: "No se pudo guardar la oportunidad." };
    if (!data)
      return {
        error: "La oportunidad cambió. Copia tus cambios y vuelve a abrirla.",
      };
    target = data.id;
  } else {
    const { data, error } = await ctx.db
      .from("opportunities")
      .insert({ ...input.data, organization_id: ctx.organization.id })
      .select("id")
      .single();
    if (error)
      return {
        error: "No se pudo crear la oportunidad. Revisa cliente y línea.",
      };
    target = data.id;
  }
  revalidatePath("/comercial/pipeline");
  redirect(`/comercial/pipeline?selected=${target}`);
}
