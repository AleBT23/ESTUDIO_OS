// Componentes reales renderizados por tests/mobile-layout.test.ts; datos de prueba.
// Comprueba composición, no una sesión Auth ni un dispositivo Apple físico.
import { chromium, webkit } from "@playwright/test";
import { readFile, mkdir, writeFile } from "node:fs/promises";
await mkdir(".local/layout-checks", { recursive: true });
const sizes = [
  [375, 667],
  [390, 844],
  [844, 390],
  [768, 1024],
  [1024, 768],
  [1440, 1000],
  [390, 420],
];
const results = [];
for (const [engineName, engine] of [
  ["chromium", chromium],
  ["webkit", webkit],
]) {
  const browser = await engine.launch({ headless: true });
  try {
    for (const [width, height] of sizes) {
      const context = await browser.newContext({
        viewport: { width, height },
        hasTouch: width <= 1024,
        isMobile: width <= 1024,
      });
      const page = await context.newPage();
      for (const name of ["quote", "project", "dialog"]) {
        await page.setContent(
          await readFile(`.local/layout-fixtures/${name}.html`, "utf8"),
          { waitUntil: "domcontentloaded" },
        );
        await page.addStyleTag({
          content:
            "*,*::before,*::after{animation:none!important;transition:none!important}",
        });
        if (name === "dialog")
          await page.locator("dialog").evaluate((dialog) => dialog.showModal());
        const metrics = await page.evaluate(() => {
          const dialog = document.querySelector("dialog[open]");
          const rect = dialog?.getBoundingClientRect();
          const smallControls = Array.from(
            document.querySelectorAll(
              "input:not([type=hidden]):not([type=checkbox]),select,textarea,button",
            ),
          )
            .filter((el) => {
              const r = el.getBoundingClientRect();
              return (
                r.width &&
                r.height &&
                getComputedStyle(el).visibility !== "hidden" &&
                r.height < 43
              );
            })
            .map(
              (el) =>
                el.getAttribute("name") ||
                el.getAttribute("aria-label") ||
                el.tagName,
            );
          return {
            overflow: document.documentElement.scrollWidth > innerWidth + 1,
            dialogFits:
              !rect || (rect.top >= -1 && rect.bottom <= innerHeight + 1),
            smallControls,
          };
        });
        const ok =
          !metrics.overflow &&
          metrics.dialogFits &&
          (width > 1024 || metrics.smallControls.length === 0);
        results.push({
          engine: engineName,
          name,
          width,
          height,
          ok,
          ...metrics,
        });
        if (
          engineName === "webkit" &&
          ((width === 390 && height === 844 && name === "quote") ||
            (width === 768 && name === "project") ||
            (height === 420 && name === "dialog"))
        )
          await page.screenshot({
            path: `.local/layout-checks/${name}-${width}x${height}.png`,
            fullPage: true,
          });
      }
      await context.close();
    }
  } finally {
    await browser.close();
  }
}
await writeFile(
  ".local/layout-checks/results.json",
  JSON.stringify(results, null, 2),
);
const failures = results.filter((r) => !r.ok);
console.log(
  JSON.stringify({
    checks: results.length,
    passed: results.length - failures.length,
    failures,
  }),
);
if (failures.length) process.exitCode = 1;
