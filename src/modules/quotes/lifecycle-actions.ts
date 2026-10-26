"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireContext } from "@/shared/auth/context";
import { canManageCommercial } from "@/shared/permissions";
import type { FormState } from "@/shared/auth/actions";
export async function changeQuoteLifecycle(
  _previous: FormState,
  form: FormData,
): Promise<FormState> {
  const ctx = await requireContext();
  if (!canManageCommercial(ctx.membership.role))
    return { error: "Tu rol no permite cambiar el estado de una propuesta." };
  const input = z
    .object({
      id: z.uuid(),
      version: z.coerce.number().int().positive(),
      intent: z.enum(["reject", "expire", "revise"]),
      reason: z.string().trim().min(3).max(1000),
      valid_until: z.union([z.literal(""), z.iso.date()]).optional(),
    })
    .safeParse(Object.fromEntries(form));
  if (!input.success)
    return { error: "Revisa el motivo y la fecha de vigencia de la revisión." };
  if (input.data.intent === "revise" && !input.data.valid_until)
    return { error: "Indica una vigencia para la nueva revisión." };
  const { error } = await ctx.db.rpc("change_quote_lifecycle", {
    org: ctx.organization.id,
    quote: input.data.id,
    expected_version: input.data.version,
    intent: input.data.intent,
    reason: input.data.reason,
    new_valid_until:
      input.data.intent === "revise" ? input.data.valid_until : null,
  });
  if (error)
    return {
      error:
        "No se cambió la propuesta. Revisa su estado y vigencia; recarga si alguien la editó. Las cotizaciones aceptadas no se reabren.",
    };
  revalidatePath("/comercial/cotizaciones");
  revalidatePath("/comercial/cotizaciones/" + input.data.id);
  return {
    success:
      input.data.intent === "revise"
        ? "Revisión preparada. Los PDFs previos se conservan; edita y emite la nueva propuesta."
        : "Estado actualizado y motivo registrado.",
  };
}
