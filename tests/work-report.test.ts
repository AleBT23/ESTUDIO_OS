import { it, expect } from "vitest";
import { workCsv, workItemCsv } from "@/modules/finance/work-report";
it("exporta centavos exactos, signo y margen vacío para recursos administrados", () => {
  const csv = workCsv([
    {
      managed: true,
      revenue_cents: "9007199254740993",
      cost_cents: "1",
      received_cents: "0",
      paid_cents: "1",
      receivable_cents: "9007199254740993",
      payable_cents: "0",
      cash_cents: "-1",
      expected_margin_cents: null,
    },
  ]);
  expect(csv).toContain(
    "Administrados,90071992547409.93,0.01,0.00,0.01,90071992547409.93,0.00,-0.01,\r\n",
  );
});
it("protege el texto libre y conserva los importes exactos por partida", () => {
  const csv = workItemCsv([{
    chapter: "=1+2", description: 'Pintura, "azul"', unit: "m2",
    quantity: "1", measured: "0.5", remaining: "0.5",
    price: "3", budget: "3", earned: "2", outstanding: "1",
  }]);
  expect(csv).toContain(`"'=1+2","Pintura, ""azul""","m2",1,0.5,0.5,0.03,0.03,0.02,0.01\r\n`);
});
