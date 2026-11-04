import { expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import ProjectsPage from "@/app/proyectos/page";
const { context } = vi.hoisted(() => ({ context: vi.fn() }));
vi.mock("@/shared/auth/context", () => ({ getContext: context }));
it("mantiene estado, búsqueda y destino de captura más allá del proyecto 200", async () => {
  const range = vi.fn(),
    eq = vi.fn();
  const data = {
    count: 242,
    data: [
      {
        id: "p211",
        name: "Casa norte",
        state: "active",
        start_date: "2026-11-04",
      },
    ],
  };
  const query = {
    select: () => query,
    eq,
    is: () => query,
    order: () => query,
    range,
    ilike: () => data,
  };
  eq.mockReturnValue(query);
  range.mockReturnValue(query);
  context.mockResolvedValue({
    organization: { id: "org" },
    membership: { role: "reader" },
    db: { from: () => query },
  });
  const html = renderToStaticMarkup(
    await ProjectsPage({
      searchParams: Promise.resolve({
        q: "Casa",
        state: "active",
        crear: "visita",
        page: "8",
      }),
    }),
  );
  expect(range).toHaveBeenCalledWith(210, 239);
  expect(eq).toHaveBeenCalledWith("state", "active");
  expect(html).toContain("/proyectos/p211#bitacora");
  expect(html).toContain("q=Casa&amp;state=active&amp;crear=visita&amp;page=9");
});
