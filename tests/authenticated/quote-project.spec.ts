import { test, expect } from "@playwright/test";
import { randomUUID, createHash } from "node:crypto";
import { PDFDocument } from "pdf-lib";
import { login } from "./login";
test("emite una propuesta, recupera su PDF y convierte el anticipo en un plan pendiente", async ({
  page,
}) => {
  await login(page, "ADMIN");
  const ref = randomUUID(),
    client = "001 Cliente E2E " + ref,
    project = "Proyecto E2E " + ref;
  await page.goto("/comercial/clientes/nuevo");
  await page.getByLabel("Nombre o razón social").fill(client);
  await page.getByRole("button", { name: "Crear cliente" }).click();
  await expect(page).toHaveURL(/\/comercial\/clientes\/[0-9a-f-]{36}$/);
  await page.goto("/comercial/cotizaciones/nueva");
  await page.getByLabel("Nombre del proyecto").fill(project);
  await page
    .getByLabel("Cliente *", { exact: true })
    .selectOption({ label: client });
  await page.getByRole("button", { name: "Partida personalizada" }).click();
  await page
    .getByLabel("Concepto *", { exact: true })
    .fill("Proyecto arquitectónico");
  await page.getByLabel("Precio unitario MXN").fill("25000");
  await page.getByLabel("Horas previstas").fill("10");
  await page.getByLabel("Costo interno por hora MXN").fill("500");
  await page.getByRole("button", { name: "Guardar borrador" }).click();
  await expect(page).toHaveURL(/\/comercial\/cotizaciones\/[0-9a-f-]{36}$/);
  await page
    .getByText("Rentabilidad interna prevista", { exact: true })
    .click();
  await expect(page.getByText("80.00 %", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Emitir versión inmutable" }).click();
  const link = page.getByRole("link", { name: "Descargar PDF", exact: true });
  await expect(link).toBeVisible();
  const url = await link.getAttribute("href");
  expect(url).toMatch(/^\/api\/documentos\/[0-9a-f-]{36}$/);
  const pdf = await page.request.get(url!);
  expect(pdf.status()).toBe(200);
  const bytes = await pdf.body();
  expect((await PDFDocument.load(bytes)).getPageCount()).toBeGreaterThan(0);
  await page.getByRole("button", { name: /Registrar envío/ }).click();
  await page
    .getByRole("button", { name: "Registrar aceptación y plan de cobro" })
    .click();
  await expect(page).toHaveURL(/\/proyectos\/[0-9a-f-]{36}$/);
  await expect(page.getByRole("heading", { name: project })).toBeVisible();
  const summary = page.locator("#cobros .finance-summary");
  const amount = (label: string) =>
    summary.getByText(label, { exact: true }).locator("+ dd");
  await expect(amount("Importe acordado MXN")).toContainText("25,000.00");
  await expect(amount("Recibido MXN")).toContainText("$0.00");
  await expect(amount("Saldo por recibir MXN")).toContainText("25,000.00");
  await page.getByText("Ver el plan de cobro", { exact: true }).click();
  await expect(page.getByText(/Anticipo · .*12,500.00/)).toBeVisible();
  const stored = await page.request.get(url!);
  expect(
    createHash("sha256")
      .update(await stored.body())
      .digest("hex"),
  ).toBe(createHash("sha256").update(bytes).digest("hex"));
});
