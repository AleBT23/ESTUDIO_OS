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
  await expect(page).toHaveURL((url) => url.pathname === "/acceso");
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
  const logo = page.getByAltText("Logo de Alejandro Barajas Arquitectura");
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
    "/api/biblioteca/" + id,
    "/api/recibos/" + id + "?origen=proyecto",
    "/api/obras/" + id + "/reporte",
    "/api/reportes/productividad",
    "/api/comprobantes/" + id,
    "/api/documentos/" + id,
    "/api/cotizaciones/" + id + "/preview",
    "/api/documentos-estudio/" + id + "/preview",
  ])
    expect((await request.get(path)).status()).toBe(403);
  for (const path of [
    "/buscar",
    "/configuracion/equipo",
    "/configuracion/equipo/invitaciones",
    "/agenda?view=board",
    "/agenda/notificaciones",
    "/agenda/recordatorios",
    "/comercial/marketing",
    "/recursos/biblioteca",
    "/recursos/procedimientos",
    "/recursos/plantillas",
    "/proyectos/" + id + "/tiempo/" + id,
    "/administracion/proveedores",
    "/administracion/tarifas",
    "/administracion/proveedores/" + id,
    "/administracion/reprogramaciones",
    "/comercial/pipeline",
    "/comercial/catalogo",
    "/comercial/conceptos",
    "/comercial/presets",
    "/comercial/cotizaciones/nueva",
    "/recursos/documentos",
  ]) {
    await page.goto(path);
    await expect(page).toHaveURL(
      (url) =>
        url.pathname === "/acceso" && url.searchParams.get("volver") === path,
    );
  }
});

test("la barra lateral conserva la preferencia al recargar", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await page.getByRole("button", { name: "Contraer barra lateral" }).click();
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Expandir barra lateral" }),
  ).toBeVisible();
  await page
    .getByRole("navigation", { name: "Navegación principal" })
    .getByRole("link", { name: "Comercial", exact: true })
    .click();
  await expect(page).toHaveURL(/\/comercial$/);
});

test("el modo oscuro conserva la preferencia y el contraste de superficie al navegar", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Activar modo oscuro" }).click();
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  expect(
    await page
      .locator("body")
      .evaluate((el) => getComputedStyle(el).backgroundColor),
  ).toBe("rgb(23, 27, 25)");
  await page.getByRole("button", { name: "Activar modo claro" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
});

test("portal público separa el acceso del cliente de la navegación del despacho", async ({
  page,
}) => {
  await page.goto("/portal");
  await expect(
    page.getByRole("navigation", { name: "Navegación principal" }),
  ).toHaveCount(0);
  if (await page.getByRole("heading", { name: "Portal de clientes" }).count()) {
    await expect(
      page.getByRole("button", { name: "Entrar al portal" }),
    ).toBeVisible();
    await page.getByText("Crear cuenta de cliente", { exact: true }).click();
    await expect(
      page.getByLabel("Contraseña de al menos 12 caracteres"),
    ).toBeVisible();
  } else {
    await expect(
      page.getByText("El portal está pendiente de conexión."),
    ).toBeVisible();
  }
});

test("la invitación ofrece acceso y registro de cuenta sin crear membresías al abrirla", async ({
  page,
}) => {
  await page.goto("/invitaciones");
  if (
    await page.getByRole("heading", { name: "Acceder con invitación" }).count()
  ) {
    await expect(
      page.getByRole("button", { name: "Entrar al estudio" }),
    ).toBeVisible();
    await page
      .getByText("Crear cuenta para aceptar una invitación", { exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Crear cuenta", exact: true }),
    ).toBeVisible();
    const form = page.locator("details form");
    await form.getByLabel("Correo electrónico").fill("prueba@local");
    await form.getByLabel(/Contraseña/).fill("valor-sintetico-de-prueba");
    await form.getByRole("button", { name: "Crear cuenta" }).click();
    await expect(form.getByRole("alert")).toContainText("Revisa el correo");
    await expect(form.getByLabel("Correo electrónico")).toHaveValue(
      "prueba@local",
    );
  } else
    await expect(
      page.getByText("Las invitaciones requieren conexión con el estudio."),
    ).toBeVisible();
});
test("los adjuntos del expediente requieren sesión", async ({ request }) => {
  const response = await request.get(
    "/api/expedientes/11111111-1111-4111-8111-111111111111",
  );
  expect(response.status()).toBe(403);
  expect(response.headers()["cache-control"]).toContain("no-store");
});

test("el menú móvil libera el foco y el desplazamiento al pasar a escritorio", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  const toggle = page.getByRole("button", { name: "Abrir menú" });
  await toggle.click();
  await page.keyboard.press("Escape");
  await expect(toggle).toBeFocused();
  await toggle.click();
  await page.setViewportSize({ width: 1280, height: 800 });
  await expect(page.locator(".mobile-overlay")).toHaveCount(0);
  expect(await page.evaluate(() => document.body.style.overflow)).not.toBe(
    "hidden",
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
});
