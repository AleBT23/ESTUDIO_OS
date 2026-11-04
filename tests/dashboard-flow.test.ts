import { expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { PeriodFlow } from "@/modules/dashboard/period-flow";
const { context, get } = vi.hoisted(() => ({ context: vi.fn(), get: vi.fn() }));
vi.mock("@/shared/auth/context", () => ({ requireContext: context }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get }) }));
vi.mock("@/modules/dashboard/cash-filter-action", () => ({
  setCashFilter: vi.fn(),
}));
it("concuerda el desglose de inicio con la selección que se exporta", async () => {
  const rpc = vi.fn().mockResolvedValue({
    data: [
      {
        area: "construction",
        managed: true,
        received: "10000",
        paid: "1000",
        net: "9000",
      },
      {
        area: "service",
        managed: false,
        received: "40000",
        paid: "20000",
        net: "20000",
      },
    ],
  });
  const line = "123e4567-e89b-42d3-a456-426614174000";
  context.mockResolvedValue({
    organization: { id: "org" },
    membership: { role: "owner" },
    user: { id: "user" },
    lines: [{ id: line, name: "Diseño" }],
    db: { rpc },
  });
  get.mockReturnValue({ value: "from_date=2026-10-01&line=" + line });
  const html = renderToStaticMarkup(await PeriodFlow());
  expect(rpc).toHaveBeenCalledWith("area_cash_report", {
    org: "org",
    from_date: "2026-10-01",
    to_date: null,
    line,
  });
  expect(html).toContain("50.00 %");
  expect(html).not.toContain("90.00 %");
  expect(html).toContain("line=" + line + "&amp;detalle=areas");
  expect(get).toHaveBeenCalledWith("studio-flow-org-user");
});
