"use server";
import { z } from "zod";
import { requireContext } from "@/shared/auth/context";
import { revalidatePath } from "next/cache";
import type { RecordState } from "@/shared/ui/record-form";
const role = z.enum(["admin", "collaborator", "reader"]);
export async function changeRole(
  _previous: RecordState,
  form: FormData,
): Promise<RecordState> {
  const ctx = await requireContext();
  if (ctx.membership.role !== "owner")
    return { error: "Solo el propietario puede cambiar permisos." };
  const input = z
    .object({ id: z.uuid(), org: z.uuid(), expected: role, desired: role })
    .safeParse(Object.fromEntries(form));
  if (!input.success || input.data.org !== ctx.organization.id)
    return { error: "Revisa el miembro y los roles." };
  if (input.data.expected === input.data.desired)
    return { error: "Selecciona un rol distinto del vigente." };
  const { error } = await ctx.db.rpc("change_studio_member_role", {
    org: ctx.organization.id,
    member: input.data.id,
    expected: input.data.expected,
    desired: input.data.desired,
  });
  if (error)
    return {
      error: "El rol cambió o ya no tienes permisos. Actualiza el equipo.",
    };
  revalidatePath("/configuracion/equipo");
  return { success: "Rol actualizado." };
}
