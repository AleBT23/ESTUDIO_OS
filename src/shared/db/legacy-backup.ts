import { z } from "zod";
const keys = [
  "archiquote_services",
  "archiquote_proposals",
  "archiquote_settings",
  "archiquote_proposal_counter",
  "archiquote_letterhead_b64",
  "archiquote_concept_library",
  "archiquote_clients",
  "archiquote_presets",
] as const;
const schema = z.object({
  payload: z.object({
    format: z.literal("estudio-os-legacy"),
    version: z.literal(1),
    exportedAt: z.iso.datetime(),
    origin: z.string(),
    entries: z.record(z.enum(keys), z.string().nullable()),
    counts: z.record(z.enum(keys), z.number().int().nonnegative().nullable()),
    errors: z.array(z.string()),
  }),
  checksum: z.object({
    algorithm: z.literal("SHA-256"),
    value: z.string().regex(/^[a-f0-9]{64}$/),
  }),
});
export async function verifyLegacyBackup(input: unknown) {
  const backup = schema.parse(input);
  const bytes = new TextEncoder().encode(JSON.stringify(backup.payload));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  const actual = Array.from(new Uint8Array(digest), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
  if (actual !== backup.checksum.value)
    throw new Error("El archivo no coincide con su huella de verificación.");
  const issues = [...backup.payload.errors];
  for (const key of keys) {
    const raw = backup.payload.entries[key];
    let count: number | null = 0;
    if (raw !== null) {
      if (key === "archiquote_letterhead_b64") count = raw.length ? 1 : 0;
      else {
        try {
          const value = JSON.parse(raw);
          count = Array.isArray(value) ? value.length : 1;
        } catch {
          count = null;
          issues.push(`JSON inválido: ${key}`);
        }
      }
    }
    if (count !== backup.payload.counts[key])
      throw new Error(`Conteo inconsistente: ${key}`);
  }
  return {
    payload: backup.payload,
    issues,
    validForImport: issues.length === 0,
  };
}
