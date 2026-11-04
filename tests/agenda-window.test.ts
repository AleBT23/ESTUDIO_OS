import { expect, it } from "vitest";
import { studioToday, weekThrough } from "@/modules/projects/agenda-window";
it("el periodo de siete días parte de la fecha local del estudio y cruza el año", () => {
  const instant = new Date("2027-01-01T04:00:00Z");
  expect(studioToday("America/Mexico_City", instant)).toBe("2026-12-31");
  expect(weekThrough(studioToday("America/Mexico_City", instant))).toBe(
    "2027-01-06",
  );
  expect(weekThrough("2028-02-27")).toBe("2028-03-04");
});
