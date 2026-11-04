import { expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import Operations from "@/app/administracion/operaciones/page";
const { context } = vi.hoisted(() => ({ context: vi.fn() }));
vi.mock("@/shared/auth/context", () => ({ requireContext: context }));
vi.mock("@/modules/finance/operation-form", () => ({
  OperationForm: () => null,
}));
it("consulta saldos administrados por pagar conservando área, fondos y paginación", async () => {
  const eq = vi.fn(),
    gt = vi.fn(),
    range = vi.fn();
  const query = {
    data: [],
    count: 64,
    select: () => query,
    eq,
    gt,
    range,
    is: () => query,
    order: () => query,
  };
  for (const method of [eq, gt, range]) method.mockReturnValue(query);
  context.mockResolvedValue({
    organization: { id: "org" },
    membership: { role: "owner" },
    db: { from: () => query },
  });
  const html = renderToStaticMarkup(
    await Operations({
      searchParams: Promise.resolve({
        area: "construction",
        fondos: "administrados",
        saldo: "pagar",
        page: "2",
      }),
    }),
  );
  expect(eq).toHaveBeenCalledWith("managed", true);
  expect(gt).toHaveBeenCalledWith("payable_cents", 0);
  expect(range).toHaveBeenCalledWith(30, 59);
  expect(html).toContain(
    "area=construction&amp;fondos=administrados&amp;saldo=pagar&amp;page=3",
  );
  expect(html).toContain(
    'href="?fondos=administrados&amp;saldo=pagar&amp;page=1"',
  );
});
