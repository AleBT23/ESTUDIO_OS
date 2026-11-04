import { expect, it } from "vitest";
import { mergePresetText } from "@/modules/quotes/preset-text";
it("conserva las cláusulas propias y admite presets anteriores sin cláusulas", () => {
  const draft = { notes: "", conditions: "Anticipo" };
  expect(
    mergePresetText(draft, { notes: "Alcance", conditions: "Entrega" }),
  ).toEqual({ notes: "Alcance", conditions: "Anticipo\n\nEntrega" });
  expect(mergePresetText(draft, { notes: "", conditions: "" })).toEqual(draft);
  expect(
    mergePresetText(draft, { notes: "", conditions: "X".repeat(20000) }),
  ).toBeNull();
});
