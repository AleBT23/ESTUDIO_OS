"use server";
import { revalidatePath } from "next/cache";
import { requireContext } from "@/shared/auth/context";
import { verifyLegacyBackup } from "@/shared/db/legacy-backup";
import {
  selectLegacyService,
  selectLegacyPreset,
} from "@/shared/db/legacy-service";
import type { RecordState } from "@/shared/ui/record-form";
export async function stageLegacyService(
  _: RecordState,
  form: FormData,
): Promise<RecordState> {
  const ctx = await requireContext();
  if (process.env.APP_ENV !== "staging" || ctx.membership.role !== "owner")
    return { error: "Se requiere un propietario en staging." };
  const file = form.get("file"),
    line = form.get("line"),
    id = form.get("legacy_id");
  if (
    !(file instanceof File) ||
    file.size > 8 * 1024 * 1024 ||
    typeof id !== "string" ||
    !ctx.lines.some((l) => l.id === line)
  )
    return { error: "Selecciona archivo, identificador y línea." };
  let item;
  try {
    const { payload, validForImport } = await verifyLegacyBackup(
      JSON.parse(await file.text()),
    );
    if (!validForImport)
      return { error: "El respaldo contiene errores de exportación." };
    item = selectLegacyService(payload.entries, id.trim());
  } catch {
    return {
      error:
        "Comprueba la huella, la moneda MXN y que el servicio tenga identificador y nombre únicos.",
    };
  }
  const { data, error } = await ctx.db.rpc("stage_legacy_service", {
    org: ctx.organization.id,
    line,
    item,
  });
  if (error)
    return {
      error:
        "No se importó el servicio. Comprueba los permisos de staging, el precio, los duplicados y la línea seleccionada.",
    };
  revalidatePath("/comercial/catalogo");
  return {
    success:
      data === "inserted"
        ? "Servicio incorporado al catálogo de staging."
        : "El servicio ya coincide con el catálogo.",
  };
}

export async function stageLegacyPreset(
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
    return { error: "Selecciona el respaldo y el identificador." };
  let item;
  try {
    const { payload, validForImport } = await verifyLegacyBackup(
      JSON.parse(await file.text()),
    );
    if (!validForImport)
      return { error: "El respaldo contiene errores de exportación." };
    item = selectLegacyPreset(payload.entries, id.trim());
  } catch {
    return {
      error: "Revisa la exportación y el identificador único del preset.",
    };
  }
  const { data, error } = await ctx.db.rpc("stage_legacy_preset", {
    org: ctx.organization.id,
    item,
  });
  if (error)
    return {
      error:
        "Comprueba que cada servicio esté importado y activo y que el preset coincida con el catálogo de staging.",
    };
  revalidatePath("/comercial/presets");
  return {
    success:
      data === "inserted"
        ? "Preset incorporado al catálogo de staging."
        : "El preset ya coincide con el catálogo.",
  };
}
