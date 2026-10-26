import { it, expect } from "vitest";
import { createHash } from "node:crypto";
import { verifyLegacyBackup } from "@/shared/db/legacy-backup";
function backup() {
  const keys = [
    "archiquote_services",
    "archiquote_proposals",
    "archiquote_settings",
    "archiquote_proposal_counter",
    "archiquote_letterhead_b64",
    "archiquote_concept_library",
    "archiquote_clients",
    "archiquote_presets",
  ];
  const payload = {
    format: "estudio-os-legacy",
    version: 1,
    exportedAt: "2026-10-19T12:00:00.000Z",
    origin: "https://original.example",
    entries: Object.fromEntries(keys.map((k) => [k, null])),
    counts: Object.fromEntries(keys.map((k) => [k, 0])),
    errors: [],
  };
  return {
    payload,
    checksum: {
      algorithm: "SHA-256",
      value: createHash("sha256").update(JSON.stringify(payload)).digest("hex"),
    },
  };
}
it("valida exportación íntegra y conteos", async () => {
  expect((await verifyLegacyBackup(backup())).validForImport).toBe(true);
});
it("detecta modificación de datos tras exportar", async () => {
  const file = backup();
  file.payload.origin = "alterado";
  await expect(verifyLegacyBackup(file)).rejects.toThrow("huella");
});
it("rechaza conteos falsos incluso con checksum recalculado", async () => {
  const file = backup();
  file.payload.counts.archiquote_clients = 3;
  file.checksum.value = createHash("sha256")
    .update(JSON.stringify(file.payload))
    .digest("hex");
  await expect(verifyLegacyBackup(file)).rejects.toThrow("Conteo");
});
