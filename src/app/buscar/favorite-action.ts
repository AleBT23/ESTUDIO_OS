"use server";
import { requireContext } from "@/shared/auth/context";
import { revalidatePath } from "next/cache";
import { z } from "zod";
export async function changeFavorite(form: FormData) {
  const ctx = await requireContext(),
    { source, id, intent } = z
      .object({
        source: z.string().max(40),
        id: z.uuid(),
        intent: z.enum(["add", "remove"]),
      })
      .parse(Object.fromEntries(form));
  const key = { organization_id: ctx.organization.id, source, record_id: id },
    table = ctx.db.from("studio_favorites");
  const r =
    intent === "add"
      ? await table.insert(key)
      : await table.delete().match({ ...key, user_id: ctx.user.id });
  if (r.error && !(intent === "add" && r.error.code === "23505"))
    throw Error(
      "No se pudo actualizar el favorito. Revisa tu acceso al registro.",
    );
  revalidatePath("/buscar");
}
