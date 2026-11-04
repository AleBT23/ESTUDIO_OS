import { expect, it } from "vitest";
import { studioDestination } from "@/shared/auth/destination";
it("conserva los filtros del estudio y rechaza destinos externos y rutas normalizadas", () => {
  expect(studioDestination("/agenda?view=board")).toBe("/agenda?view=board");
  for (const value of [
    "https://otro.test",
    "//otro.test",
    "/agenda/..//otro.test",
    "/agenda/%2e%2e/acceso",
    "/api/prueba",
    null,
  ])
    expect(studioDestination(value)).toBe("/");
});
