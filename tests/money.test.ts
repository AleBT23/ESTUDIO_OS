import { describe, it, expect } from "vitest";
import { calculateQuote, splitAdvance, formatMoney } from "@/shared/money";
describe("Dinero exacto y planes", () => {
  it("formatea sin perder centavos en el máximo seguro y en negativos pequeños", () => {
    expect(formatMoney(Number.MAX_SAFE_INTEGER)).toBe("$90,071,992,547,409.91");
    expect(formatMoney(-1)).toBe("-$0.01");
    expect(formatMoney(0)).toBe("$0.00");
  });
  it("calcula descuento e IVA sobre el neto", () => {
    expect(
      calculateQuote(
        [{ quantity: "2", unitPrice: "100", discount: "10", unit: "unit" }],
        "16",
        true,
      ),
    ).toMatchObject({
      subtotal: 20000,
      discount: 2000,
      net: 18000,
      tax: 2880,
      total: 20880,
    });
  });
  it("corrige porcentaje del costo de obra: 8% de 1 millón", () => {
    expect(
      calculateQuote(
        [{ quantity: "1000000", unitPrice: "8", discount: "0", unit: "pct" }],
        "16",
        false,
      ).total,
    ).toBe(8000000);
  });
  it("redondea HALF_UP por partida e impuesto una vez", () => {
    expect(
      calculateQuote(
        [
          { quantity: "1", unitPrice: "0.105", discount: "0", unit: "unit" },
          { quantity: "1", unitPrice: "0.105", discount: "0", unit: "unit" },
        ],
        "16",
        true,
      ),
    ).toMatchObject({ subtotal: 22, tax: 4, total: 26 });
  });
  it("25,000 con anticipo 50% permanece sin cobros", () => {
    expect(splitAdvance(2500000, "50")).toEqual({
      advance: 1250000,
      balance: 1250000,
      collected: 0,
    });
  });
  it("preserva cada centavo en planes impares", () => {
    const plan = splitAdvance(101, "50");
    expect(plan.advance + plan.balance).toBe(101);
  });
  it.each(["-1", "NaN", "Infinity", "1e3", "1000000000000"])(
    "rechaza importes inválidos: %s",
    (value) => {
      expect(() =>
        calculateQuote(
          [{ quantity: value, unitPrice: "1", discount: "0", unit: "unit" }],
          "16",
          true,
        ),
      ).toThrow();
    },
  );
  it("rechaza porcentajes fuera de rango y desbordamiento", () => {
    expect(() => splitAdvance(100, "101")).toThrow();
    expect(() =>
      calculateQuote(
        [
          {
            quantity: "999999999999",
            unitPrice: "999999999999",
            discount: "0",
            unit: "unit",
          },
        ],
        "16",
        true,
      ),
    ).toThrow();
  });
});
