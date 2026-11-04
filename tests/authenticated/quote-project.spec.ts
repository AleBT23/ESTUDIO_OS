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
  await expect(
    page
      .locator("#plan-cobro strong")
      .filter({ hasText: /Anticipo · .*12,500.00/ }),
  ).toBeVisible();
  const payment = page.locator("#cobros form").filter({
    has: page.getByRole("heading", { name: "Registrar un pago recibido" }),
  });
  const advance = payment.getByRole("option", {
    name: /Anticipo · Contrato base/,
  });
  await payment
    .getByLabel("Obligación de pago")
    .selectOption((await advance.getAttribute("value")) ?? "");
  const packageSelect = payment.getByLabel(
    "Paquete al que corresponde el cobro",
  );
  await expect(packageSelect.locator("option")).toHaveCount(2);
  const packageId = await packageSelect
    .locator("option")
    .nth(1)
    .getAttribute("value");
  await packageSelect.selectOption(packageId!);
  await payment.getByLabel("Importe recibido MXN").fill("2500");
  const reference = "Transferencia parcial " + ref;
  await payment.getByLabel("Referencia del movimiento").fill(reference);
  await payment.getByRole("button", { name: "Registrar cobro" }).click();
  await expect(amount("Recibido MXN")).toContainText("2,500.00");
  await expect(amount("Saldo por recibir MXN")).toContainText("22,500.00");
  await page.reload();
  const entry = page
    .locator("#cobros .payment-row")
    .filter({ hasText: reference });
  const ledger = await page.request.get(
    "/api/reportes/productividad?detalle=movimientos&package=" + packageId,
  );
  expect(ledger.status()).toBe(200);
  expect(await ledger.text()).toContain(reference);
  const receipt = await entry
    .getByRole("link", { name: "Descargar recibo PDF" })
    .getAttribute("href");
  const file = await page.request.get(receipt!);
  expect(file.status()).toBe(200);
  expect(
    (await PDFDocument.load(await file.body())).getPageCount(),
  ).toBeGreaterThan(0);
  await entry.getByText("Revertir movimiento", { exact: true }).click();
  await entry
    .getByLabel("Motivo del reverso")
    .fill("Corrección documentada de referencia");
  await entry.getByRole("button", { name: "Confirmar reverso" }).click();
  await expect(entry.getByText("Revertido", { exact: true })).toBeVisible();
  await expect(amount("Recibido MXN")).toContainText("$0.00");
  await expect(amount("Saldo por recibir MXN")).toContainText("25,000.00");
  const stored = await page.request.get(url!);
  expect(
    createHash("sha256")
      .update(await stored.body())
      .digest("hex"),
  ).toBe(createHash("sha256").update(bytes).digest("hex"));
});
