import { expect, type Page } from "@playwright/test";
export async function login(
  page: Page,
  role: "ADMIN" | "READER",
  destination?: string,
) {
  await page.goto(destination ?? "/acceso");
  await page
    .getByLabel("Correo electrónico")
    .fill(process.env["ESTUDIO_TEST_" + role + "_EMAIL"]!);
  await page
    .getByLabel("Contraseña", { exact: true })
    .fill(process.env["ESTUDIO_TEST_" + role + "_PASSWORD"]!);
  await page.getByRole("button", { name: "Entrar al estudio" }).click();
  await expect(page).toHaveURL(
    new URL(destination ?? "/", "http://127.0.0.1:3419").href,
  );
}
