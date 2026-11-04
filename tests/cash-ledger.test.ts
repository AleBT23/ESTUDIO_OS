import { expect, it } from "vitest";
import { ledgerCsv } from "@/modules/finance/cash-ledger";
it("escapa celdas de terceros y conserva el importe original con flujo cero en un reverso", () => {
  const row = {
    id: "123",
    source: "acuerdo",
    paid_on: "2026-11-02",
    concept: "=SUM(1,2)",
    client_name: 'Peña "A"',
    project_name: null,
    work_name: null,
    supplier: null,
    package_name: "Planos",
    line_name: "Visualización",
    area: "construction" as const,
    managed: true,
    direction: "out",
    amount: "12501",
    reference: null,
    expense_category: "labor" as const,
    reversed: false,
    reversed_at: null,
    reversal_reason: null,
  };
  const csv = ledgerCsv([
    row,
    { ...row, reversed: true, reversal_reason: "Corrección" },
  ]);
  expect(csv).toContain('"\'=SUM(1,2)"');
  expect(csv).toContain('"Peña ""A"""');
  expect(csv).toContain('","Planos","Visualización"');
  expect(csv).toContain("Pago,125.01,-125.01");
  expect(csv).toContain("Pago,125.01,0.00");
  expect(csv).toContain('Revertido,,"Corrección"');
});
