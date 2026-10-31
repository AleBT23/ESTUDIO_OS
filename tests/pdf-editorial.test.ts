import { it, expect } from "vitest";
import { mkdir, writeFile } from "node:fs/promises";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { ReactPdfRenderer } from "@/modules/documents/pdf-renderer";
import {
  defaultDocumentOptions,
  type QuoteSnapshot,
} from "@/modules/documents/schema";
import { calculateQuote } from "@/shared/money";
function sample(): QuoteSnapshot {
  const totals = calculateQuote(
    [{ quantity: "1", unitPrice: "11520", discount: "0", unit: "unit" }],
    "16",
    false,
  );
  return {
    folio: "MUESTRA · SIN VALIDEZ",
    issued_at: "2026-10-31T12:00:00Z",
    organization: { name: "Alejandro Torres Arquitectura" },
    client: { name: "Cliente de ejemplo", email: "", phone: "", address: "" },
    quote: {
      name: "Proyecto residencial · Estudio de suelos",
      currency: "MXN",
      vat_rate: 16,
      apply_vat: false,
      advance_rate: 50,
      valid_until: "2026-11-14",
      notes:
        "Estudio de mecánica de suelos para conocer las características y la capacidad de carga del terreno del proyecto habitacional.",
      conditions:
        "Los trabajos adicionales al alcance descrito se cotizarán por separado.",
      subtotal_cents: totals.subtotal,
      discount_cents: totals.discount,
      tax_cents: totals.tax,
      total_cents: totals.total,
    },
    items: [
      {
        code: "EST-01",
        name: "Estudio de mecánica de suelos",
        description:
          "Estudio de mecánica de suelos\nExploración mediante pozo a cielo abierto, extracción de muestra y ensayos de laboratorio. Incluye equipo de excavación e informe de resultados técnicos.",
        quantity: "1",
        unit: "unit",
        unit_price_cents: 1152000,
        discount_rate: "0",
        business_line_id: "11111111-1111-4111-8111-111111111111",
      },
    ],
    options: structuredClone(defaultDocumentOptions),
  };
}
async function inspect(s: QuoteSnapshot, name: string) {
  const bytes = await new ReactPdfRenderer().render(s);
  await mkdir("tests/artifacts", { recursive: true });
  await writeFile("tests/artifacts/" + name + ".pdf", bytes);
  const task = getDocument({ data: new Uint8Array(bytes) });
  const doc = await task.promise;
  const pages = [];
  for (let n = 1; n <= doc.numPages; n++) {
    const content = await (await doc.getPage(n)).getTextContent();
    pages.push(content.items.filter((i) => "str" in i));
  }
  await task.destroy();
  return pages;
}
it("compacta alcance, presupuesto y firmas sin repetir la descripción ni perder datos", async () => {
  const s = sample();
  s.client.phone = "452 000 0000";
  const before = JSON.stringify(s);
  const pages = await inspect(s, "cotizacion-refinada");
  expect(JSON.stringify(s)).toBe(before);
  expect(pages).toHaveLength(1);
  const text = pages
    .flat()
    .map((i) => i.str)
    .join(" ");
  expect(text.match(/Estudio de mecánica de suelos/g)).toHaveLength(2); // alcance + encabezado de partida
  expect(text).toContain("452 000 0000");
  expect(text).toContain("$11,520.00");
  expect(text).toContain("condiciones");
  const client = pages[0].find((i) => i.str === "Nombre y firma del cliente")!;
  const studio = pages[0].find((i) => i.str === "Nombre y firma del estudio")!;
  expect(client).toBeDefined();
  expect(studio).toBeDefined();
  expect(Math.abs(client.transform[5] - studio.transform[5])).toBeLessThan(1);
});
it("conserva partidas iguales, orden opcional y firmas al final de condiciones extensas", async () => {
  const s = sample();
  s.items.push({ ...s.items[0] });
  s.quote.subtotal_cents *= 2;
  s.quote.total_cents *= 2;
  s.quote.conditions =
    "Condición específica para la ejecución del estudio. ".repeat(150) +
    "FIN-CONDICIONES";
  const pages = await inspect(s, "cotizacion-refinada-condiciones");
  const text = pages
    .flat()
    .map((i) => i.str)
    .join(" ");
  expect(text.match(/EST-01/g)).toHaveLength(2);
  expect(text).toContain("$23,040.00");
  expect(text.indexOf("Nombre y firma del cliente")).toBeGreaterThan(
    text.indexOf("FIN-CONDICIONES"),
  );
  s.options.sections = ["acceptance", "budget", "scope", "conditions"];
  const reordered = await inspect(s, "cotizacion-refinada-orden");
  expect(reordered[0].map((i) => i.str).join(" ")).toContain(
    "Nombre y firma del cliente",
  );
});
