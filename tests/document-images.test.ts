import { it, expect } from "vitest";
import sharp from "sharp";
import { getDocument, OPS } from "pdfjs-dist/legacy/build/pdf.mjs";
import { StandaloneRenderer } from "@/modules/documents/standalone-renderer";
import { documentImageIds } from "@/modules/documents/image-references";
import { normalizeDocumentImage } from "@/modules/documents/document-image";
import { defaultDocumentOptions } from "@/modules/documents/schema";
const id = "11111111-1111-4111-8111-111111111111";
const snapshot = {
  kind: "site_report" as const,
  title: "Evidencia de obra",
  date: "2026-11-04",
  folio: "DOC-01",
  margins: defaultDocumentOptions.margins,
  client: null,
  project: null,
  organization: { name: "Estudio" },
  body: "Antes de la imagen\n[[imagen:" + id + "]]\nDespués de la imagen",
};
it("incorpora la revisión binaria privada además del membrete y conserva el texto", async () => {
  const original = await sharp({
    create: { width: 120, height: 60, channels: 3, background: "#10957c" },
  })
    .png()
    .toBuffer();
  const normalized = await normalizeDocumentImage(original);
  const pdf = await new StandaloneRenderer().render(
    snapshot,
    new Map([[id, normalized]]),
  );
  const task = getDocument({
    data: new Uint8Array(pdf),
    useSystemFonts: false,
  });
  try {
    const doc = await task.promise,
      page = await doc.getPage(1);
    expect(
      (await page.getOperatorList()).fnArray.filter(
        (op) => op === OPS.paintImageXObject,
      ).length,
    ).toBe(2);
    const text = (await page.getTextContent()).items
      .map((i) => ("str" in i ? i.str : ""))
      .join(" ");
    expect(text).toContain("Después de la imagen");
    expect(text).not.toContain(id);
  } finally {
    await task.destroy();
  }
});
it("rechaza referencias ajenas al formato, archivos no raster y revisiones ausentes", async () => {
  expect(() =>
    documentImageIds("[[imagen:https://example.test/a.jpg]]"),
  ).toThrow();
  expect(() =>
    documentImageIds(
      Array(13)
        .fill("[[imagen:" + id + "]]")
        .join("\n"),
    ),
  ).toThrow();
  await expect(normalizeDocumentImage(Buffer.from("<svg/>"))).rejects.toThrow();
  await expect(new StandaloneRenderer().render(snapshot)).rejects.toThrow(
    /Imagen no disponible/,
  );
});
