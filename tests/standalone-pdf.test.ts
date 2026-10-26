import { it, expect } from "vitest";
import { mkdir, writeFile } from "node:fs/promises";
import { getDocument, OPS } from "pdfjs-dist/legacy/build/pdf.mjs";
import { StandaloneRenderer } from "@/modules/documents/standalone-renderer";
import type { StandaloneSnapshot } from "@/modules/documents/standalone-schema";
const snapshot: StandaloneSnapshot = {
  folio: "DOC-2026-0001",
  title: "Minuta de coordinación",
  kind: "minutes",
  body: "Para {{cliente.nombre}}, en {{proyecto.nombre}}.\n\n## Acuerdos de diseño\n- Revisar iluminación y ventilación.\n- Confirmar el área útil en m².\n\nFecha: {{fecha}}.\n{{despacho.nombre}}",
  date: "2026-10-19",
  organization: { name: "Alejandro Torres Arquitectura" },
  client: { name: "María Ñúñez" },
  project: { name: "Casa del jardín" },
  margins: { top: 26, bottom: 29, left: 16, right: 32 },
};
async function inspect(pdf: Buffer) {
  const task = getDocument({
    data: new Uint8Array(pdf),
    useSystemFonts: false,
  });
  const doc = await task.promise;
  let text = "";
  for (let index = 1; index <= doc.numPages; index++) {
    const page = await doc.getPage(index);
    expect(page.view).toEqual([0, 0, 612, 792]);
    expect((await page.getOperatorList()).fnArray).toContain(
      OPS.paintImageXObject,
    );
    const content = await page.getTextContent();
    const pageText = content.items
      .filter((i) => "str" in i)
      .map((i) => i.str)
      .join(" ");
    expect(pageText).toContain(index + " / " + doc.numPages);
    text += pageText;
    for (const item of content.items) {
      if ("str" in item && item.str.trim()) {
        expect(item.transform[5]).toBeGreaterThan(0);
        expect(item.transform[5]).toBeLessThan(792);
      }
    }
  }
  const count = doc.numPages;
  await task.destroy();
  return { text, count };
}
it("genera y reabre minuta independiente carta con variables resueltas y sin presupuesto", async () => {
  const pdf = await new StandaloneRenderer().render(snapshot);
  await mkdir("tests/artifacts", { recursive: true });
  await writeFile("tests/artifacts/minuta-estudio.pdf", pdf);
  const { text, count } = await inspect(pdf);
  expect(count).toBe(1);
  expect(text).toContain("María Ñúñez");
  expect(text).toContain("Casa del jardín");
  expect(text).toContain("m²");
  expect(text).not.toContain("{{");
  expect(text).not.toContain("TOTAL");
  expect(text).toContain("Acuerdos de diseño");
});
it("pagina reportes largos con membrete y conserva el último acuerdo", async () => {
  const pdf = await new StandaloneRenderer().render({
    ...snapshot,
    title: "Reporte de visita",
    kind: "site_report",
    body: Array.from(
      { length: 75 },
      (_, index) =>
        "Observación " +
        (index + 1) +
        ": Se revisaron iluminación, materiales y acabados con {{cliente.nombre}}.",
    ).join("\n"),
  });
  await writeFile("tests/artifacts/reporte-visita.pdf", pdf);
  const { text, count } = await inspect(pdf);
  expect(count).toBeGreaterThan(1);
  expect(text).toContain("Observación 75");
});
it("no emite documentos con variables faltantes o no permitidas", async () => {
  await expect(
    new StandaloneRenderer().render({ ...snapshot, client: null }),
  ).rejects.toThrow("Faltan datos");
  await expect(
    new StandaloneRenderer().render({
      ...snapshot,
      body: "{{usuario.password}}",
    }),
  ).rejects.toThrow("no permitida");
});
