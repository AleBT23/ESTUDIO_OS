"use server";
import { requireContext } from "@/shared/auth/context";
import { verifyLegacyBackup } from "@/shared/db/legacy-backup";
import { selectLegacyProposal } from "@/shared/db/legacy-service";
import type { RecordState } from "@/shared/ui/record-form";
import { revalidatePath } from "next/cache";
export async function stageHistoricalQuote(
  _: RecordState,
  form: FormData,
): Promise<RecordState> {
  const ctx = await requireContext();
  if (process.env.APP_ENV !== "staging" || ctx.membership.role !== "owner")
    return { error: "Se requiere un propietario en staging." };
  const file = form.get("file"),
    id = form.get("legacy_id");
  if (
    !(file instanceof File) ||
    file.size > 8 * 1024 * 1024 ||
    typeof id !== "string"
  )
    return { error: "Selecciona respaldo y propuesta." };
  try {
    const { payload, checksum, validForImport } = await verifyLegacyBackup(
      JSON.parse(await file.text()),
    );
    if (!validForImport)
      return { error: "El respaldo contiene errores de exportación." };
    const item = selectLegacyProposal(payload.entries, id);
    const currency = JSON.parse(
      payload.entries.archiquote_settings ?? "null",
    )?.currency;
    const { data, error } = await ctx.db.rpc("stage_historical_quote", {
      org: ctx.organization.id,
      item,
      checksum,
      currency_setting: typeof currency === "string" ? currency : null,
    });
    if (error)
      return {
        error:
          "Comprueba el destino de staging y las diferencias con el registro existente.",
      };
    revalidatePath("/configuracion/archivo");
    return {
      success:
        data === "inserted"
          ? "Propuesta guardada en el archivo histórico."
          : "La propuesta ya coincide con el archivo.",
    };
  } catch {
    return {
      error: "Verifica la huella, el identificador y el folio de la propuesta.",
    };
  }
}
