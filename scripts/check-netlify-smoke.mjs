// Prueba de la compilación local, sin sesión ni escrituras. No acredita Auth remoto.
import { chromium, webkit } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
const origin = process.env.ESTUDIO_SMOKE_URL || "http://127.0.0.1:3107";
const parsed = new URL(origin);
assert(
  ["127.0.0.1", "localhost"].includes(parsed.hostname),
  "Esta prueba solo permite loopback.",
);
await mkdir(".local/netlify-smoke", { recursive: true });
const results = [];
const id = "11111111-1111-4111-8111-111111111111";
for (const [name, engine] of [
  ["chromium", chromium],
  ["webkit", webkit],
]) {
  const browser = await engine.launch({ headless: true });
  try {
    const context = await browser.newContext({ baseURL: origin });
    for (const [path, expected] of [
      ["/acceso", 200],
      ["/api/cotizaciones/" + id + "/preview", 403],
      ["/api/documentos-estudio/" + id + "/preview", 403],
      ["/api/documentos/" + id, 403],
      ["/api/fotografias/" + id, 401],
      ["/proyectos/" + id, 307],
      ["/comercial/cotizaciones/nueva", 307],
    ]) {
      const response = await context.request.get(path, { maxRedirects: 0 });
      if (expected === 307)
        assert([200, 307].includes(response.status()), path);
      else assert.equal(response.status(), expected, path);
      if (path.includes("/api/"))
        assert.match(
          response.headers()["cache-control"] || "",
          /private.*no-store/,
        );
      results.push({ engine: name, path, status: response.status() });
    }
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    for (const path of ["/proyectos/" + id, "/comercial/cotizaciones/nueva"]) {
      // Next puede iniciar streaming con HTTP 200 y redirigir mediante el cliente.
      await page.goto(path, { waitUntil: "networkidle" });
      await page.waitForURL("**/acceso");
      results.push({ engine: name, path, redirectedToLogin: true });
    }
    for (const width of [390, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/", { waitUntil: "networkidle" });
      assert.match(await page.title(), /ESTUDIO OS/);
      if (width === 390) {
        await page.getByRole("button", { name: "Abrir menú" }).click();
        await page.keyboard.press("Escape");
      }
      await page.goto("/acceso", { waitUntil: "networkidle" });
      assert.equal(await page.locator('input[type="password"]').count(), 1);
      assert(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
      );
      await page.screenshot({
        path: `.local/netlify-smoke/${name}-${width}.png`,
      });
      results.push({
        engine: name,
        viewport: width,
        login: true,
        overflow: false,
      });
    }
    assert.deepEqual(errors, []);
    await context.close();
  } finally {
    await browser.close();
  }
}
await writeFile(
  ".local/netlify-smoke/results.json",
  JSON.stringify(results, null, 2),
);
console.log(
  `${results.length} comprobaciones correctas (Chromium/WebKit, rutas privadas y login sin sesión). Sin escrituras remotas.`,
);
