import { expect, it } from "vitest";
import { selectLegacyService } from "@/shared/db/legacy-service";
const item = {
  id: "srv-1",
  name: "Topografía",
  price: 25.15,
  active: true,
  unit: "visit",
};
const entries = {
  archiquote_services: JSON.stringify([item]),
  archiquote_settings: '{"currency":"MXN"}',
};
it("selecciona únicamente el identificador indicado y exige moneda de origen", () => {
  expect(selectLegacyService(entries, item.id)).toEqual(item);
  expect(() =>
    selectLegacyService(
      { ...entries, archiquote_settings: '{"currency":"USD"}' },
      item.id,
    ),
  ).toThrow("MXN");
  expect(() =>
    selectLegacyService({ ...entries, archiquote_settings: null }, item.id),
  ).toThrow("MXN");
  expect(() => selectLegacyService(entries, "ausente")).toThrow(
    "identificador",
  );
  expect(() =>
    selectLegacyService(
      {
        ...entries,
        archiquote_services: JSON.stringify([item, { ...item, id: "otro" }]),
      },
      item.id,
    ),
  ).toThrow("duplicado");
});
