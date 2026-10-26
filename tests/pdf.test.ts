import { it, expect } from "vitest";
import { mkdir, writeFile } from "node:fs/promises";
import { ReactPdfRenderer } from "@/modules/documents/pdf-renderer";
import {
  defaultDocumentOptions,
  type QuoteSnapshot,
} from "@/modules/documents/schema";
import { calculateQuote } from "@/shared/money";
import { getDocument, OPS } from "pdfjs-dist/legacy/build/pdf.mjs";
import {
  PDFDocument,
  PDFDict,
  PDFArray,
  PDFName,
  PDFRawStream,
  decodePDFRawStream,
} from "pdf-lib";
export function fixture(count = 1): QuoteSnapshot {
  const items = Array.from({ length: count }, (_, index) => ({
    name: `Diseño arquitectónico ${index + 1}`,
    description:
      "Diseño, iluminación y revisión para María Ñúñez. Área útil en m². Sin costos internos.",
    quantity: "1",
    unit: "unit",
    unit_price_cents: 2500000,
    discount_rate: "0",
    business_line_id: "11111111-1111-4111-8111-111111111111",
  }));
  const totals = calculateQuote(
    items.map((i) => ({
      quantity: i.quantity,
      unitPrice: "25000",
      discount: "0",
      unit: i.unit,
    })),
    "16",
    true,
  );
  return {
    folio: "COT-2026-0001",
    issued_at: "2026-10-19T12:00:00Z",
    organization: { name: "Alejandro Torres Arquitectura" },
    client: {
      name: "María Ñúñez",
      email: "",
      phone: "",
      address: "Uruapan, Michoacán, México",
    },
    quote: {
      name: "Propuesta de diseño y visualización",
      currency: "MXN",
      vat_rate: 16,
      apply_vat: true,
      advance_rate: 50,
      valid_until: "2026-11-02",
      notes:
        "Arquitectura, diseño e iluminación. Alcance de la propuesta para un espacio habitable y sereno.",
      conditions:
        "El alcance contempla las partidas indicadas. Los cambios adicionales se cotizarán por separado.",
      subtotal_cents: totals.subtotal,
      discount_cents: totals.discount,
      tax_cents: totals.tax,
      total_cents: totals.total,
    },
    items,
    options: structuredClone(defaultDocumentOptions),
  };
}
it("genera y reabre PDF carta, Unicode, membrete y contenido dentro de página", async () => {
  const s = fixture();
  s.options.sections = ["budget"];
  const pdf = await new ReactPdfRenderer().render(s);
  expect(pdf.subarray(0, 4).toString()).toBe("%PDF");
  expect(pdf.length).toBeGreaterThan(10000);
  await mkdir("tests/artifacts", { recursive: true });
  await writeFile("tests/artifacts/cotizacion-carta.pdf", pdf);
  const task = getDocument({
    data: new Uint8Array(pdf),
    useSystemFonts: false,
  });
  const doc = await task.promise;
  expect(doc.numPages).toBe(1);
  const page = await doc.getPage(1);
  expect(page.view).toEqual([0, 0, 612, 792]);
  const content = await page.getTextContent();
  const text = content.items
    .filter((i) => "str" in i)
    .map((i) => i.str)
    .join(" ");
  expect(text).toContain("María Ñúñez");
  expect(text).toContain("m²");
  expect(text).toContain("$29,000.00");
  expect(text).toContain("1 / 1");
  for (const item of content.items) {
    if ("str" in item && item.str.trim()) {
      expect(item.transform[5]).toBeGreaterThan(0);
      expect(item.transform[5]).toBeLessThan(792);
      expect(item.transform[4]).toBeGreaterThanOrEqual(0);
      expect(item.transform[4]).toBeLessThan(612);
    }
  }
  expect((await page.getOperatorList()).fnArray).toContain(
    OPS.paintImageXObject,
  );
  await task.destroy();
});
it("genera tabla multipágina y secciones, sin aceptar totales manipulados", async () => {
  const s = fixture(45);
  s.options.sections = [
    "cover",
    "thanks",
    "scope",
    "budget",
    "conditions",
    "acceptance",
  ];
  const pdf = await new ReactPdfRenderer().render(s);
  await writeFile("tests/artifacts/cotizacion-larga.pdf", pdf);
  expect(pdf.length).toBeGreaterThan(10000);
  const task = getDocument({
    data: new Uint8Array(pdf),
    useSystemFonts: false,
  });
  const document = await task.promise;
  expect(document.numPages).toBeGreaterThan(6);
  let body = "";
  for (let index = 1; index <= document.numPages; index++) {
    const page = await document.getPage(index);
    const content = await page.getTextContent();
    const text = content.items
      .filter((i) => "str" in i)
      .map((i) => i.str)
      .join(" ");
    body += text + " ";
    expect(text).toContain(index + " / " + document.numPages);
    if (text.includes("Diseño arquitectónico"))
      expect(text).toContain("CONCEPTO");
    expect((await page.getOperatorList()).fnArray).toContain(
      OPS.paintImageXObject,
    );
    for (const item of content.items) {
      if ("str" in item && item.str.trim()) {
        expect(item.transform[5]).toBeGreaterThan(0);
        expect(item.transform[5]).toBeLessThan(792);
      }
    }
  }
  for (let index = 1; index <= 45; index++)
    expect(body).toContain("Diseño arquitectónico " + index);
  expect(body).toContain("Aceptación");
  expect(body).toContain("$1,305,000.00");
  await task.destroy();
  s.quote.total_cents++;
  await expect(new ReactPdfRenderer().render(s)).rejects.toThrow("totales");
});

it("incrusta Poppins real y conserva conceptos extensos, claves, escalas y encabezados", async () => {
  const s = fixture(4);
  s.folio = "MUESTRA · SIN VALIDEZ";
  s.quote.name = "Prueba de composición editorial (datos sintéticos)";
  s.options.sections = ["budget", "conditions"];
  s.items.forEach((item, index) => {
    Object.assign(item, { code: "ARQ-0" + (index + 1) });
    item.description =
      "Revisión del diseño, coordinación de materiales e iluminación, criterios de ejecución y entregables. ".repeat(
        index === 1 ? 80 : 4,
      ) +
      " FIN-CONCEPTO-" +
      (index + 1);
  });
  const pdf = await new ReactPdfRenderer().render(s);
  await mkdir("tests/artifacts", { recursive: true });
  await writeFile("tests/artifacts/cotizacion-poppins-extensa.pdf", pdf);
  const task = getDocument({
    data: new Uint8Array(pdf),
    useSystemFonts: false,
  });
  const doc = await task.promise;
  let body = "";
  const embedded = await PDFDocument.load(pdf);
  for (const page of embedded.getPages()) {
    const fonts = page.node.Resources()!.lookup(PDFName.of("Font"), PDFDict);
    // React PDF registra Helvetica en bloques vacíos de saltos de línea.
    // Verificamos cada bloque que realmente pinta texto, incluida numeración.
    const contents = page.node.Contents()!;
    for (const ref of contents instanceof PDFArray
      ? contents.asArray()
      : [contents]) {
      const stream = embedded.context.lookup(ref);
      if (!(stream instanceof PDFRawStream))
        throw new Error("Contenido PDF no reconocido");
      const operators = Buffer.from(
        decodePDFRawStream(stream).decode(),
      ).toString("latin1");
      for (const match of operators.matchAll(/BT([\s\S]*?)ET/g)) {
        if (!/\bT[Jj]\b/.test(match[1])) continue;
        const resource = match[1].match(/\/(\S+)\s+[\d.]+\s+Tf/)!;
        const font = fonts.lookup(PDFName.of(resource[1]), PDFDict);
        expect(
          font.lookup(PDFName.of("BaseFont"), PDFName).asString(),
        ).toContain("Poppins");
      }
    }
  }
  const sizes = new Set<number>();
  for (let n = 1; n <= doc.numPages; n++) {
    const page = await doc.getPage(n);
    await page.getOperatorList();
    const content = await page.getTextContent();
    const text = content.items
      .filter((i) => "str" in i)
      .map((i) => i.str)
      .join(" ");
    body += text + " ";
    if (text.includes("Diseño arquitectónico")) {
      expect(text).toContain("CLAVE");
      expect(text).toContain("CONCEPTO");
      expect(text).toContain("IMPORTE");
    }
    if (text.includes("CLAVE")) expect(text).toContain("Diseño arquitectónico");
    if (text.includes("Resumen económico")) expect(text).toContain("Subtotal");
    for (const item of content.items) {
      if ("str" in item && item.str.trim()) {
        sizes.add(Math.round(Math.hypot(item.transform[0], item.transform[1])));
        expect(item.transform[4] + item.width).toBeLessThanOrEqual(
          612 - (32 * 72) / 25.4 + 2,
        );
        expect(item.transform[5]).toBeGreaterThan((29 * 72) / 25.4 - 25);
        expect(item.transform[5]).toBeLessThan(792 - (22 * 72) / 25.4);
      }
    }
  }
  expect([...sizes].every((size) => [9, 11, 16, 24].includes(size))).toBe(true);
  for (let i = 1; i <= 4; i++) {
    expect(body).toContain("FIN-CONCEPTO-" + i);
    expect(body).toContain("ARQ-0" + i);
  }
  expect(body).toContain("$116,000.00");
  expect(body).toContain("Condiciones comerciales");
  expect(body).toContain("continuación");
  await task.destroy();
});
