import { it, expect } from "vitest";
import { clientSchema } from "@/modules/crm/schema";
import { canManageCommercial, canReadFinance } from "@/shared/permissions";
it("captura mínima de cliente y normalización", () => {
  expect(
    clientSchema.parse({
      name: "  María  ",
      kind: "person",
      business_line_id: "",
    }),
  ).toMatchObject({ name: "María", business_line_id: null, email: "" });
});
it("rechaza email y referencia de línea inválidos", () => {
  expect(
    clientSchema.safeParse({
      name: "María",
      kind: "person",
      email: "xxx",
      business_line_id: "externa",
    }).success,
  ).toBe(false);
});
it("colaborador y lector carecen de edición comercial y lectura financiera", () => {
  for (const role of ["reader", "collaborator"] as const) {
    expect(canManageCommercial(role)).toBe(false);
    expect(canReadFinance(role)).toBe(false);
  }
  expect(canManageCommercial("owner")).toBe(true);
});
