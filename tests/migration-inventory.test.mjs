import { expect, it } from "vitest";
import { migrationPlan } from "../scripts/migration-inventory.mjs";
const local = ["01", "02", "03"].map((name) => ({ name, sha256: name }));
it("distingue pendientes de migraciones verificadas sin ejecutar SQL", () => {
  expect(migrationPlan(local, local.slice(0, 1))).toEqual({
    compatible: true,
    verified: ["01"],
    pending: ["02", "03"],
    unknown: [],
    changed: [],
    outOfOrder: [],
  });
});
it("detecta contenido alterado, huecos y migraciones ajenas", () => {
  const result = migrationPlan(local, [
    { name: "02", sha256: "otro" },
    { name: "04", sha256: "04" },
  ]);
  expect(result).toMatchObject({
    compatible: false,
    unknown: ["04"],
    changed: ["02"],
    outOfOrder: ["02"],
  });
});
