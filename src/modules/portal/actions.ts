"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireContext } from "@/shared/auth/context";
import { canManageCommercial } from "@/shared/permissions";
import type { RecordState } from "@/shared/ui/record-form";
const account = z.object({ client_id: z.uuid(), user_id: z.uuid() });
const publish = z.object({
  id: z.uuid(),
  project_id: z.uuid(),
  deliverable_id: z.uuid(),
  resource_url: z.url({ protocol: /^https$/ }).max(2000),
});
const change = z.object({
  publication_id: z.uuid(),
  visible: z.enum(["true", "false"]),
});
export async function managePortal(
  intent: "grant" | "enable" | "revoke" | "publish" | "visibility",
  _state: RecordState,
  form: FormData,
): Promise<RecordState> {
  const ctx = await requireContext();
  if (!canManageCommercial(ctx.membership.role))
    return { error: "Permisos insuficientes." };
  const org = ctx.organization.id,
    values = Object.fromEntries(form);
  let result;
  if (intent === "publish") {
    const p = publish.safeParse(values);
    if (!p.success)
      return {
        error: "Revisa el entregable y el enlace HTTPS que verá el cliente.",
      };
    result = await ctx.db
      .from("portal_deliveries")
      .insert({ ...p.data, organization_id: org });
  } else if (intent === "visibility") {
    const p = change.safeParse(values);
    if (!p.success) return { error: "Publicación inválida." };
    result = await ctx.db
      .from("portal_deliveries")
      .update({ visible: p.data.visible === "true" })
      .eq("organization_id", org)
      .eq("id", p.data.publication_id)
      .select("id")
      .single();
  } else {
    const p = account.safeParse(values);
    if (!p.success)
      return { error: "Introduce el identificador de cuenta del portal." };
    const fields = { organization_id: org, ...p.data };
    result =
      intent === "grant"
        ? await ctx.db.from("client_portal_access").insert(fields)
        : await ctx.db
            .from("client_portal_access")
            .update({ enabled: intent === "enable" })
            .match(fields)
            .select("user_id")
            .single();
  }
  if (result.error)
    return {
      error:
        "No se pudo guardar. Revisa la cuenta, los permisos y si el registro ya existe.",
    };
  revalidatePath("/portal");
  revalidatePath("/comercial/clientes", "layout");
  revalidatePath("/proyectos", "layout");
  return { success: "Portal actualizado.", nextId: crypto.randomUUID() };
}
