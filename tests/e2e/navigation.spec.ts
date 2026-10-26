import { test, expect } from "@playwright/test";
test("cinco áreas, navegación real y ausencia de errores de hidratación", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: /Espacio para crear/ }),
  ).toBeVisible();
  const nav = page.getByRole("navigation", { name: "Navegación principal" });
  await expect(nav.getByRole("link")).toHaveCount(5);
  for (const [label, path] of [
    ["Comercial", "/comercial"],
    ["Proyectos y producción", "/proyectos"],
    ["Administración", "/administracion"],
    ["Recursos del estudio", "/recursos"],
  ] as const) {
    await nav.getByRole("link", { name: label, exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`${path}$`));
    await expect(
      page.getByRole("heading", { name: label, exact: true }),
    ).toBeVisible();
  }
  expect(errors).toEqual([]);
});
test("configuración sin credenciales explica el bloqueo y no inventa conexión", async ({
  page,
}) => {
  test.skip(
    Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
    "Caso exclusivo de instalación sin credenciales",
  );
  await page.goto("/configuracion");
  await expect(
    page.getByText("Conexión pendiente", { exact: true }),
  ).toBeVisible();
  await page.goto("/comercial/clientes/nuevo");
  await expect(page).toHaveURL(/\/acceso$/);
  await expect(
    page.getByText("El estudio aún no está conectado.", { exact: false }),
  ).toBeVisible();
});
test("móvil abre menú, navega y evita desbordamiento horizontal", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Abrir menú" })).toBeVisible();
  await page.getByRole("button", { name: "Abrir menú" }).click();
  await page
    .getByRole("navigation", { name: "Navegación principal" })
    .getByRole("link", { name: "Comercial", exact: true })
    .click();
  await expect(page).toHaveURL(/\/comercial$/);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.goto("/");
  await page.screenshot({
    path: "tests/artifacts/inicio-mobile.png",
    fullPage: true,
    animations: "disabled",
  });
});
test("marca oficial carga y captura escritorio", async ({ page }) => {
  await page.goto("/");
  const logo = page.getByAltText("Isotipo oficial del estudio");
  await expect(logo).toBeVisible();
  expect(
    await logo.evaluate((img: HTMLImageElement) => img.naturalWidth),
  ).toBeGreaterThan(0);
  await page.screenshot({
    path: "tests/artifacts/inicio-desktop.png",
    fullPage: true,
    animations: "disabled",
  });
});
test("rutas de PDF y captura protegidas rechazan acceso sin sesión", async ({
  page,
  request,
}) => {
  const id = "11111111-1111-4111-8111-111111111111";
  for (const path of [
    "/api/documentos/" + id,
    "/api/cotizaciones/" + id + "/preview",
    "/api/documentos-estudio/" + id + "/preview",
  ])
    expect((await request.get(path)).status()).toBe(403);
  for (const path of [
    "/comercial/pipeline",
    "/comercial/catalogo",
    "/comercial/conceptos",
    "/comercial/presets",
    "/comercial/cotizaciones/nueva",
    "/recursos/documentos",
  ]) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/acceso$/);
  }
});
