import { it, expect } from "vitest";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { renderReceipt } from "@/modules/finance/movement-receipt";
it("el recibo descargable identifica importe, fondos y reverso al reabrir el PDF", async () => {
  const pdf = await renderReceipt("Despacho de prueba", {
    id: "11111111-1111-4111-8111-111111111111",
    paid_on: "2026-11-04",
    amount: "30125",
    direction: "out",
    managed: true,
    reversed: true,
    reversal_reason: "Referencia duplicada",
    concept: "Estudio topográfico",
    project_name: null,
    client_name: "María",
    work_name: "Casa del Río",
    provider: "Proveedor",
    reference: "Anticipo",
  });
  const task = getDocument({
    data: new Uint8Array(pdf),
    useSystemFonts: false,
  });
  try {
    const doc = await task.promise;
    expect(doc.numPages).toBe(1);
    const content = await (await doc.getPage(1)).getTextContent();
    const text = content.items.map((i) => ("str" in i ? i.str : "")).join(" ");
    for (const term of [
      "Recibo de pago",
      "MOVIMIENTO REVERTIDO",
      "301.25",
      "Administrados del cliente",
      "Referencia duplicada",
      "Casa del Río",
      "Estudio topográfico",
    ])
      expect(text).toContain(term);
  } finally {
    await task.destroy();
  }
});
