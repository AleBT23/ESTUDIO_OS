import { expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import TimeHistory from "@/app/proyectos/[id]/tiempo/[entry]/page";
const { context } = vi.hoisted(() => ({ context: vi.fn() }));
vi.mock("@/shared/auth/context", () => ({ requireContext: context }));
it("muestra el registro corregido y el vínculo anterior con el autor de la corrección", async () => {
  const id = "11111111-1111-4111-8111-111111111111",
    entry = "22222222-2222-4222-8222-222222222222";
  const current = {
    minutes: 60,
    worked_on: "2026-11-01",
    description: "Entrega",
    task_id: null,
    package_id: null,
    version: 2,
  };
  const results: Record<string, unknown> = {
    project_time: { data: current },
    time_corrections: {
      count: 1,
      data: [
        {
          version: 1,
          actor_id: id,
          corrected_at: "2026-11-02T18:00:00Z",
          previous_values: {
            ...current,
            minutes: 45,
            task_id: entry,
            description: "Borrador",
          },
        },
      ],
    },
    project_notes: { data: [{ id: entry, body: "Revisión de planos" }] },
  };
  context.mockResolvedValue({
    user: { id },
    membership: { role: "collaborator" },
    organization: { id, timezone: "America/Mexico_City" },
    db: {
      from: (table: string) => {
        const query = {
          select: () => query,
          eq: () => query,
          order: () => query,
          maybeSingle: () => results[table],
          range: () => results[table],
          in: () => results[table],
        };
        return query;
      },
    },
  });
  const html = renderToStaticMarkup(
    await TimeHistory({
      params: Promise.resolve({ id, entry }),
      searchParams: Promise.resolve({}),
    }),
  );
  for (const value of [
    "60 min",
    "45 min",
    "Borrador",
    "Entrega",
    "Revisión de planos",
    "mi cuenta",
  ])
    expect(html).toContain(value);
});
