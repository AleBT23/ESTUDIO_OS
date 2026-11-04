"use server";
import { z } from "zod";
import { getContext, requireContext } from "@/shared/auth/context";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { RecordState } from "@/shared/ui/record-form";
export async function issueInvitation(
  _prev: RecordState,
  form: FormData,
): Promise<RecordState> {
  const ctx = await requireContext();
  if (ctx.membership.role !== "owner")
    return { error: "Permisos insuficientes." };
  const v = z
    .object({
      id: z.uuid(),
      email: z.string().trim().toLowerCase().pipe(z.email().max(254)),
      role: z.enum(["admin", "collaborator", "reader"]),
    })
    .safeParse(Object.fromEntries(form));
  if (!v.success) return { error: "Revisa el correo y el rol." };
  const { error } = await ctx.db
    .from("studio_invitations")
    .insert({ ...v.data, organization_id: ctx.organization.id });
  if (error)
    return {
      error:
        error.code === "23505"
          ? "Ya existe una invitación pendiente para este correo. Puedes revocarla antes de crear otra."
          : "No se pudo crear la invitación.",
    };
  revalidatePath("/configuracion/equipo/invitaciones");
  return {
    success:
      "Invitación creada. Comparte la dirección de la bandeja con la persona invitada.",
    nextId: crypto.randomUUID(),
  };
}
export async function revokeInvitation(
  _prev: RecordState,
  form: FormData,
): Promise<RecordState> {
  const ctx = await requireContext(),
    id = z.uuid().safeParse(form.get("id"));
  if (!id.success || ctx.membership.role !== "owner")
    return { error: "Permisos o referencia inválidos." };
  const { error } = await ctx.db.rpc("revoke_studio_invitation", {
    org: ctx.organization.id,
    invitation: id.data,
  });
  if (error) return { error: "No se pudo revocar. Actualiza el historial." };
  revalidatePath("/configuracion/equipo/invitaciones");
  return { success: "Invitación revocada." };
}
export async function acceptInvitation(
  _prev: RecordState,
  form: FormData,
): Promise<RecordState> {
  const ctx = await getContext(),
    id = z.uuid().safeParse(form.get("id"));
  if (!ctx || !id.success)
    return { error: "Inicia sesión con el correo de la invitación." };
  const { error } = await ctx.db.rpc("accept_studio_invitation", {
    invitation: id.data,
  });
  if (error)
    return {
      error:
        "No se pudo aceptar. Comprueba que esté vigente, que hayas confirmado tu correo y que no pertenezcas ya a un estudio.",
    };
  revalidatePath("/", "layout");
  redirect("/");
}
