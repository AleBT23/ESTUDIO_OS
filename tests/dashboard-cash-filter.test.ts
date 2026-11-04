import { it, expect } from "vitest";
import { cashFilter } from "@/modules/dashboard/cash-filter";
it("limita el filtro persistente a fechas válidas y líneas del estudio", () => {
  const id = "11111111-1111-4111-8111-111111111111",
    lines = [{ id }];
  const value = { line: id, from_date: "2026-10-01", to_date: "2026-10-31" };
  expect(cashFilter(value, lines)).toEqual(value);
  expect(cashFilter(value, [])).toBeNull();
  expect(cashFilter({ ...value, from_date: "2026-11-01" }, lines)).toBeNull();
  expect(cashFilter({ ...value, to_date: "2026-02-30" }, lines)).toBeNull();
  expect(cashFilter({}, lines)).toEqual({
    line: "",
    from_date: "",
    to_date: "",
  });
});
