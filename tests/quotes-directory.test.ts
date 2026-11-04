import { expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import QuotesPage from "@/app/comercial/cotizaciones/page";
const { context } = vi.hoisted(() => ({ context: vi.fn() }));
vi.mock("@/shared/auth/context", () => ({ requireContext: context }));
vi.mock("@/modules/quotes/quote-actions", () => ({ QuoteActions: () => null }));
it("consulta propuestas enviadas y conserva la selección al avanzar", async () => {
  const eq = vi.fn(),
    range = vi.fn();
  const query = {
    select: () => query,
    eq,
    is: () => query,
    order: () => query,
    range,
    ilike: () => ({ count: 72, data: [], error: null }),
  };
  eq.mockReturnValue(query);
  range.mockReturnValue(query);
  context.mockResolvedValue({
    organization: { id: "org" },
    membership: { role: "admin" },
    db: { from: () => query },
  });
  const html = renderToStaticMarkup(
    await QuotesPage({
      searchParams: Promise.resolve({ q: "Casa", status: "sent", page: "2" }),
    }),
  );
  expect(eq).toHaveBeenCalledWith("status", "sent");
  expect(range).toHaveBeenCalledWith(30, 59);
  expect(html).toContain("q=Casa&amp;status=sent&amp;page=3");
});
