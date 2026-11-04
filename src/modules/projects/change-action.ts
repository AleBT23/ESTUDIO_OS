"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireContext } from "@/shared/auth/context";
import { canManageCommercial } from "@/shared/permissions";
import type { RecordState } from "@/shared/ui/record-form";
const base = z.object({ id: z.uuid(), project_id: z.uuid() });
const request = base.extend({
  client_id: z.uuid(),
  description: z.string().trim().min(2).max(6000),
  days_impact: z.coerce.number().int().min(-3650).max(3650),
});
const binding = base.extend({ quote_id: z.uuid() });
export async function saveChange(
  intent: "request" | "bind",
  _prev: RecordState,
  form: FormData,
): Promise<RecordState> {
  const ctx = await requireContext();
  if (!canManageCommercial(ctx.membership.role))
    return { error: "Permisos insuficientes." };
  const input = (intent === "request" ? request : binding).safeParse(
    Object.fromEntries(form),
  );
  if (!input.success)
    return { error: "Revisa el alcance, el plazo y la cotización." };
  const org = ctx.organization.id,
    p = input.data;
  const result =
    "quote_id" in p
      ? await ctx.db
          .from("scope_changes")
          .update({ quote_id: p.quote_id })
          .eq("organization_id", org)
          .eq("project_id", p.project_id)
          .eq("id", p.id)
          .is("quote_id", null)
          .select("id")
          .single()
      : await ctx.db
          .from("scope_changes")
          .insert({ ...p, organization_id: org });
  if (result.error)
    return {
      error:
        "No se pudo guardar. Verifica el proyecto y que el borrador siga disponible para este cliente.",
    };
  revalidatePath("/proyectos/" + p.project_id);
  return {
    success: "Cambio de alcance actualizado.",
    ...(intent === "request" ? { nextId: crypto.randomUUID() } : {}),
  };
}
