import { expect, it } from "vitest";
import { studioTotals } from "@/modules/finance/studio-totals";
it("concilia planes y acuerdos propios y mantiene independiente el dinero de terceros", () => {
  const rows = [
    {
      managed: false,
      received_cents: "9007199254740993",
      paid_cents: null,
      receivable_cents: "90",
      payable_cents: null,
    },
    {
      managed: false,
      received_cents: "125",
      paid_cents: "25",
      receivable_cents: "75",
      payable_cents: "10",
    },
    {
      managed: true,
      received_cents: "1000",
      paid_cents: "600",
      receivable_cents: "200",
      payable_cents: "150",
    },
  ];
  expect(studioTotals(rows)).toEqual({
    own: {
      received: 9007199254741118n,
      paid: 25n,
      receivable: 165n,
      payable: 10n,
    },
    managed: { received: 1000n, paid: 600n, receivable: 200n, payable: 150n },
  });
});
