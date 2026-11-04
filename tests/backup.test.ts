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
it("concilia por partida y detecta porcentajes históricos, duplicados y enlaces sin resolver", async () => {
  const { reviewLegacyBackup } = await import("@/shared/db/legacy-review");
  const file = backup();
  const good = {
    id: "prop1",
    proposalNumber: "F01",
    clientId: "c1",
    subtotal: 200,
    discount: 20,
    vat: 28.8,
    grandTotal: 208.8,
    items: [{ unit: "unit", quantity: 2, unitPrice: 100, discount: 10 }],
  };
  const data: Record<string, unknown[]> = {
    archiquote_clients: [
      { id: "c1", name: "Casa" },
      { id: "c2", name: "CASA" },
    ],
    archiquote_presets: [{ id: "preset", serviceIds: ["ausente"] }],
    archiquote_proposals: [
      good,
      {
        ...good,
        id: "prop2",
        clientId: null,
        items: [{ unit: "pct", quantity: 2, unitPrice: 100, discount: 10 }],
      },
    ],
  };
  for (const [key, rows] of Object.entries(data)) {
    Object.assign(file.payload.entries, { [key]: JSON.stringify(rows) });
    file.payload.counts[key] = rows.length;
  }
  file.checksum.value = createHash("sha256")
    .update(JSON.stringify(file.payload))
    .digest("hex");
  const report = await reviewLegacyBackup(file);
  expect(report).toMatchObject({
    matched: 1,
    different: 1,
    unreadable: 0,
    counts: { clients: 2, proposals: 2 },
  });
  expect(report.issues.join(" ")).toMatch(/nombre repetido/);
  expect(report.issues.join(" ")).toMatch(/Folios repetidos/);
  expect(report.issues.join(" ")).toMatch(/referencias de servicios/);
  expect(report.issues.join(" ")).toMatch(/base histórica/);
  expect(report.issues.join(" ")).toMatch(/Falta la moneda/);
});
