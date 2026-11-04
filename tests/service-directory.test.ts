import { expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import CatalogPage from "@/app/comercial/catalogo/page";
const { context } = vi.hoisted(() => ({ context: vi.fn() }));
vi.mock("@/shared/auth/context", () => ({ requireContext: context }));
vi.mock("@/modules/quotes/service-form", () => ({
  ServiceForm: () => null,
  ArchiveServiceForm: () => null,
}));
it("pagina el catálogo manteniendo la categoría, búsqueda y archivo", async () => {
  const eq = vi.fn(),
    range = vi.fn(),
    not = vi.fn();
  const query = {
    select: () => query,
    eq,
    range,
    not,
    order: () => query,
    ilike: () => query,
    count: 92,
    data: [],
    error: null,
    limit: () => query,
  };
  eq.mockReturnValue(query);
  range.mockReturnValue(query);
  not.mockReturnValue(query);
  context.mockResolvedValue({
    organization: { id: "org" },
    membership: { role: "admin" },
    lines: [],
    db: { from: () => query },
  });
  const html = renderToStaticMarkup(
    await CatalogPage({
      searchParams: Promise.resolve({
        q: "Plano",
        category: "estudios",
        archived: "1",
        page: "2",
      }),
    }),
  );
  expect(range).toHaveBeenCalledWith(30, 59);
  expect(eq).toHaveBeenCalledWith("category_key", "estudios");
  expect(not).toHaveBeenCalledWith("deleted_at", "is", null);
  expect(html).toContain(
    "q=Plano&amp;category=estudios&amp;archived=1&amp;page=3",
  );
});
