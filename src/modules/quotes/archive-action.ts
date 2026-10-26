"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireContext } from "@/shared/auth/context";
import { canManageCommercial } from "@/shared/permissions";
import type { FormState } from "@/shared/auth/actions";

export async function archiveQuote(
  _previous: FormState,
  form: FormData,
): Promise<FormState> {
  const ctx = await requireContext();
  if (!canManageCommercial(ctx.membership.role))
    return { error: "Tu rol no permite eliminar cotizaciones." };
  const input = z
    .object({
      id: z.uuid(),
      version: z.coerce.number().int().positive(),
      confirmed: z.literal("yes"),
    })
    .safeParse(Object.fromEntries(form));
  if (!input.success)
    return { error: "Confirma la cotización antes de eliminarla." };
  const { error } = await ctx.db.rpc("archive_quote", {
    org: ctx.organization.id,
    quote: input.data.id,
    expected_version: input.data.version,
  });
  if (error)
    return {
      error:
        error.code === "PQ001"
          ? "Esta cotización respalda un proyecto y sus obligaciones. Consérvala y gestiona el expediente desde Proyectos."
          : error.code === "PQ002"
            ? "La cotización cambió o ya fue eliminada. Recarga antes de continuar."
            : "No se pudo eliminar la cotización. Revisa tus permisos y la conexión.",
    };
  revalidatePath("/comercial/cotizaciones");
  revalidatePath(`/comercial/cotizaciones/${input.data.id}`);
  revalidatePath("/");
  redirect("/comercial/cotizaciones?deleted=1");
}
