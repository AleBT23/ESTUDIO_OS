import { expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { PeriodIndicators } from "@/modules/dashboard/period-indicators";
const { context } = vi.hoisted(() => ({ context: vi.fn() }));
vi.mock("@/shared/auth/context", () => ({ requireContext: context }));
vi.mock("@/modules/dashboard/period-filter", () => ({
  dashboardFilter: async () => ({
    from_date: "2026-10-01",
    to_date: "2026-10-31",
    line: "line",
  }),
  PeriodFilter: () => null,
}));
it("abre la segunda página de un indicador con el mismo intervalo y permisos", async () => {
  const range = vi
    .fn()
    .mockResolvedValue({
      data: [
        {
          id: "task",
          project_id: "project",
          label: "Revisar planos",
          event_on: "2026-10-15",
        },
      ],
    });
  const query = { eq: vi.fn(), order: vi.fn(), range };
  query.eq.mockReturnValue(query);
  query.order.mockReturnValue(query);
  const rpc = vi.fn((name: string) =>
    name === "dashboard_period_counts"
      ? { data: [{ kind: "task", total: 26 }] }
      : query,
  );
  context.mockResolvedValue({
    organization: { id: "org" },
    membership: { role: "reader" },
    db: { rpc },
    lines: [],
  });
  const html = renderToStaticMarkup(
    await PeriodIndicators({ selected: "task", page: 2 }),
  );
  const args = {
    org: "org",
    from_date: "2026-10-01",
    to_date: "2026-10-31",
    line: "line",
  };
  expect(rpc).toHaveBeenCalledWith("dashboard_period_counts", args);
  expect(rpc).toHaveBeenCalledWith("dashboard_period_items", args);
  expect(query.eq).toHaveBeenCalledWith("kind", "task");
  expect(range).toHaveBeenCalledWith(25, 50);
  expect(html).toContain('href="/proyectos/project"');
  expect(html).not.toContain("Cotizaciones enviadas");
});
