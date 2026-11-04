import { z } from "zod";
type Entries = Record<string, string | null>;
export function selectLegacyService(entries: Entries, id: string) {
  const settings = z
    .object({ currency: z.literal("MXN") })
    .safeParse(JSON.parse(entries.archiquote_settings ?? "null"));
  if (!settings.success)
    throw Error("Se requiere una exportación con moneda MXN explícita.");
  return pickById(entries.archiquote_services, id);
}
export function selectLegacyPreset(entries: Entries, id: string) {
  return pickById(entries.archiquote_presets, id);
}
function pickById(raw: string | null, id: string) {
  const values = z
    .array(z.object({ id: z.string() }).passthrough())
    .max(10000)
    .parse(JSON.parse(raw ?? "[]"));
  const matches = values.filter((v) => v.id === id);
  if (matches.length !== 1)
    throw Error("El identificador debe corresponder a un único registro.");
  const selected = matches[0];
  if (
    values.some(
      (v) =>
        v !== selected &&
        typeof v.name === "string" &&
        typeof selected.name === "string" &&
        v.name.trim().toLocaleLowerCase("es-MX") ===
          selected.name.trim().toLocaleLowerCase("es-MX"),
    )
  )
    throw Error("Nombre duplicado en la exportación.");
  return selected;
}
