import { it, expect } from "vitest";
import { conceptSchema, insertConcept } from "@/modules/quotes/concept-schema";
import { estimateFees, quoteLineCostCents } from "@/shared/money";
it("inserta copia de concepto conservando el alcance de la partida", () => {
  const original = { body: "Iluminación y revisión de diseño." };
  let description = insertConcept("Modelado del edificio.", original.body);
  original.body = "Texto revisado";
  description += " Entrega final.";
  expect(description).toBe(
    "Modelado del edificio.\n\nIluminación y revisión de diseño. Entrega final.",
  );
  expect(original.body).toBe("Texto revisado");
});
it("rechaza conceptos vacíos y textos combinados demasiado extensos", () => {
  expect(conceptSchema.safeParse({ name: "  ", body: "Texto" }).success).toBe(
    false,
  );
  expect(
    conceptSchema.safeParse({ name: "Concepto", body: "  " }).success,
  ).toBe(false);
  expect(() => insertConcept("a".repeat(9999), "Texto")).toThrow("10,000");
  expect(insertConcept("", "Descripción con ñ y m²")).toBe(
    "Descripción con ñ y m²",
  );
});
it("honorarios calculan margen e ingreso horario sin incluir IVA ni descontar horas dos veces", () => {
  expect(estimateFees(2500000, "5000.00", "100")).toEqual({
    externalCostCents: 500000,
    laborCostCents: null,
    profitCents: 2000000,
    marginPercent: "80.00",
    effectiveHourlyCents: 25000,
  });
});
it("estimación admite pérdida y evita divisiones por cero", () => {
  expect(estimateFees(10000, "120.00", "0")).toMatchObject({
    profitCents: -2000,
    marginPercent: "-20.00",
    effectiveHourlyCents: null,
  });
  expect(estimateFees(0, "10.00", "2")).toMatchObject({
    profitCents: -1000,
    marginPercent: null,
    effectiveHourlyCents: 0,
  });
});
it("rechaza horas/costos inválidos y tarifa fuera del rango seguro", () => {
  expect(() => estimateFees(100, "-1", "10")).toThrow();
  expect(() => estimateFees(100, "0", "NaN")).toThrow();
  expect(() => estimateFees(Number.MAX_SAFE_INTEGER, "0", "0.0001")).toThrow(
    "tarifa",
  );
});
it("descuenta las horas previstas una sola vez y distingue cero de una tarifa ausente", () => {
  expect(estimateFees(2500000, "5000.00", "10.125", "800.00")).toMatchObject({
    laborCostCents: 810000,
    profitCents: 1190000,
    marginPercent: "47.60",
  });
  expect(estimateFees(10000, "0", "2", "0")).toMatchObject({
    laborCostCents: 0,
    profitCents: 10000,
  });
});
it("concilia el costo directo con la base de obra y las cantidades fraccionarias", () => {
  const costs =
    quoteLineCostCents({ unit: "pct", quantity: "100000", unitCost: "30.00" }) +
    quoteLineCostCents({ unit: "m2", quantity: "2.5", unitCost: "1.01" });
  expect(costs).toBe(3253);
  expect(estimateFees(250000, "10", "1", "100", costs).profitCents).toBe(
    235747,
  );
});
