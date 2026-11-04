import { login } from "./login";
import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
test("administración registra un anticipo propio y concilia el saldo después de recargar", async ({
  page,
}) => {
  await login(page, "ADMIN");
  await page.goto("/administracion/operaciones?crear=acuerdo");
  const form = page.locator("#nuevo-acuerdo"),
    name = "Topografía E2E " + randomUUID();
  await form.getByLabel("Concepto").fill(name);
  await form.getByLabel("Área", { exact: true }).selectOption("service");
  await form.getByLabel("Ingreso acordado MXN").fill("1000.00");
  await form.getByLabel("Costo comprometido MXN").fill("300.00");
  await form.getByRole("button", { name: "Guardar" }).click();
  await page.getByRole("link", { name, exact: true }).click();
  await page.getByText("Registrar cobro", { exact: true }).click();
  const movement = page
    .locator("details")
    .filter({ has: page.locator("summary", { hasText: /^Registrar cobro$/ }) });
  await movement.getByLabel("Importe MXN").fill("250.00");
  await movement.getByLabel("Anticipo aplicado al acuerdo").check();
  await movement.getByRole("button", { name: "Guardar" }).click();
  await expect(page.getByText(/Cobro anticipado/)).toBeVisible();
  await page.reload();
  const amount = (label: string) =>
    page
      .locator("dt")
      .filter({ hasText: new RegExp("^" + label + "$") })
      .locator("+ dd");
  await expect(amount("Cobrado")).toContainText("250.00");
  await expect(amount("Por cobrar")).toContainText("750.00");
  await expect(amount("Margen previsto")).toContainText("700.00");
  const csv = await page.request.get(
    "/api/reportes/productividad?detalle=areas",
  );
  expect(csv.status()).toBe(200);
  expect(await csv.text()).toContain("Servicio complementario,Propios");
});
test("el lector autenticado carece de acceso a captura financiera y exportación", async ({
  page,
}) => {
  await login(page, "READER");
  await page.goto("/administracion/operaciones");
  await expect(
    page.getByText("Tu rol no permite consultar finanzas."),
  ).toBeVisible();
  expect(
    (
      await page.request.get("/api/reportes/productividad?detalle=areas")
    ).status(),
  ).toBe(403);
});
