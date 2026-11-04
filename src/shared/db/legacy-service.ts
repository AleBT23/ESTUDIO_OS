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
export function selectLegacyConcept(entries: Entries, id: string) {
  return pickById(entries.archiquote_concept_library, id);
}
export function selectLegacyPreset(entries: Entries, id: string) {
  return pickById(entries.archiquote_presets, id);
}
export function selectLegacyProposal(entries: Entries, id: string) {
  return pickById(entries.archiquote_proposals, id, "proposalNumber");
}
function pickById(raw: string | null, id: string, field = "name") {
  const values = z
    .array(z.object({ id: z.string() }).passthrough())
    .max(10000)
    .parse(JSON.parse(raw ?? "[]"));
  const matches = values.filter((v) => v.id === id);
  if (matches.length !== 1)
    throw Error("El identificador debe corresponder a un único registro.");
  const selected = matches[0];
  const name = selected[field];
  if (
    typeof name === "string" &&
    values.some((v) => {
      const other = v[field];
      return (
        v !== selected &&
        typeof other === "string" &&
        other.trim().toLocaleLowerCase("es-MX") ===
          name.trim().toLocaleLowerCase("es-MX")
      );
    })
  )
    throw Error("Nombre o folio duplicado en la exportación.");
  return selected;
}
