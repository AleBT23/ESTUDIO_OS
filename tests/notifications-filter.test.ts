import { expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import Notifications from "@/app/agenda/notificaciones/page";
const { context } = vi.hoisted(() => ({ context: vi.fn() }));
vi.mock("@/shared/auth/context", () => ({ requireContext: context }));
vi.mock("@/modules/projects/notification-action", () => ({
  markNotification: vi.fn(),
}));
it("filtra los cobros y conserva la selección entre páginas y bandejas", async () => {
  const eq = vi.fn(),
    range = vi.fn().mockResolvedValue({ data: [], count: 55 });
  const query = {
    select: () => query,
    eq,
    not: () => query,
    order: () => query,
    range,
  };
  eq.mockReturnValue(query);
  context.mockResolvedValue({
    organization: { id: "org" },
    db: { from: () => query },
  });
  const html = renderToStaticMarkup(
    await Notifications({
      searchParams: Promise.resolve({
        kind: "collection",
        read: "1",
        page: "2",
      }),
    }),
  );
  expect(eq).toHaveBeenCalledWith("kind", "collection");
  expect(range).toHaveBeenCalledWith(25, 49);
  expect(html).toContain("read=1&amp;kind=collection&amp;page=3");
  expect(html).toContain("read=0&amp;kind=collection&amp;page=1");
});
