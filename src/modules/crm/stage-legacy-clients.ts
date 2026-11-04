"use server";
import { z } from "zod";
import { requireContext } from "@/shared/auth/context";
import { verifyLegacyBackup } from "@/shared/db/legacy-backup";
import { revalidatePath } from "next/cache";
import type { RecordState } from "@/shared/ui/record-form";
const rows = z
  .array(
    z.object({
      id: z.string().trim().min(1).max(160),
      name: z.string().trim().min(2).max(160),
      phone: z.string().trim().max(40).optional(),
      email: z.union([z.literal(""), z.email().max(254)]).optional(),
    }),
  )
  .min(1)
  .max(2000);
export async function stageLegacyClients(
  _: RecordState,
  form: FormData,
): Promise<RecordState> {
  const ctx = await requireContext();
  if (process.env.APP_ENV !== "staging" || ctx.membership.role !== "owner")
    return { error: "Solo disponible para el propietario en staging." };
  const file = form.get("file"),
    kind = z.enum(["person", "company"]).safeParse(form.get("kind"));
  if (!(file instanceof File) || file.size > 8 * 1024 * 1024 || !kind.success)
    return {
      error: "Selecciona tipo de cliente y un respaldo de hasta 8 MiB.",
    };
  let batch: z.infer<typeof rows>;
  try {
    const parsed = await verifyLegacyBackup(JSON.parse(await file.text()));
    if (!parsed.validForImport)
      return { error: "El respaldo contiene errores de exportación." };
    batch = rows.parse(
      JSON.parse(parsed.payload.entries.archiquote_clients ?? "[]"),
    );
  } catch {
    return {
      error:
        "Comprueba la huella y los datos de clientes. Se admiten hasta 2.000 clientes por exportación.",
    };
  }
  const { data, error } = await ctx.db.rpc("stage_legacy_clients", {
    org: ctx.organization.id,
    batch,
    client_kind: kind.data,
  });
  if (error)
    return {
      error:
        error.code === "42501"
          ? "El destino aislado no está habilitado para este estudio."
          : "No se importó el lote. Revisa duplicados y diferencias frente al directorio existente.",
    };
  revalidatePath("/comercial");
  return {
    success:
      "Clientes incorporados: " +
      data.inserted +
      ". Ya coincidentes: " +
      data.unchanged +
      ".",
  };
}
