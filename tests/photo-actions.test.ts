import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  context: vi.fn(),
  publish: vi.fn(),
  rows: vi.fn(),
  cleanup: vi.fn(),
  revalidate: vi.fn(),
}));
vi.mock("@/shared/auth/context", () => ({ requireContext: mocks.context }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
vi.mock("@/modules/projects/photo-publish", () => ({
  publishPreparedPhotos: mocks.publish,
  preparedPhotoRows: mocks.rows,
  cleanupTemporaryPhotos: mocks.cleanup,
}));
import {
  prepareObservation,
  finishObservation,
  cancelObservation,
} from "@/modules/projects/photo-actions";
const org = "11111111-1111-4111-8111-111111111111";
const project = "22222222-2222-4222-8222-222222222222";
const request = "33333333-3333-4333-8333-333333333333";
const user = "44444444-4444-4444-8444-444444444444";
function fixture() {
  let role = "owner";
  let available = true;
  let observation: Record<string, unknown> | null = null;
  const inserted: { table: string; value: unknown }[] = [];
  const filters: { table: string; column: string; value: unknown }[] = [];
  const rpc = vi.fn(
    async (
      name: string,
      args: { observation?: string; photo_sizes?: number[] },
    ) => ({
      error: null,
      data:
        name === "prepare_project_observation"
          ? {
              observation: args.observation,
              photos: (args.photo_sizes || []).map((size, i) => ({
                path: org + "/" + args.observation + "/" + i + ".jpg",
                size,
              })),
            }
          : null,
    }),
  );
  const db = {
    from: (table: string) => {
      const query = {
        select: () => query,
        eq: (column: string, value: unknown) => {
          filters.push({ table, column, value });
          return query;
        },
        is: () => query,
        maybeSingle: async () => ({
          data:
            table === "projects"
              ? available
                ? { id: project }
                : null
              : observation,
          error: null,
        }),
        insert: async (value: unknown) => {
          inserted.push({ table, value });
          return { error: null };
        },
      };
      return query;
    },
    storage: { from: () => ({ remove: async () => ({ error: null }) }) },
    rpc,
  };
  mocks.context.mockImplementation(async () => ({
    db,
    user: { id: user },
    membership: { role },
    organization: { id: org, timezone: "America/Mexico_City" },
  }));
  return {
    inserted,
    filters,
    rpc,
    role: (value: string) => {
      role = value;
    },
    available: (value: boolean) => {
      available = value;
    },
    observation: (value: Record<string, unknown> | null) => {
      observation = value;
    },
  };
}
function form() {
  const result = new FormData();
  result.set("project", project);
  result.set("body", "Revisión de prueba");
  result.set("observed_on", "2026-01-01");
  return result;
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.rows.mockResolvedValue([]);
  mocks.cleanup.mockResolvedValue(true);
  mocks.publish.mockResolvedValue(true);
});
it("prepara solo metadatos, comprueba organización/proyecto y genera rutas propias", async () => {
  const f = fixture();
  const result = await prepareObservation(
    form(),
    Array.from({ length: 5 }, () => ({
      type: "image/jpeg",
      size: 2097152,
    })),
    request,
  );
  expect(result.plan?.photos).toHaveLength(5);
  expect(
    result.plan?.photos.every((p) =>
      p.path.startsWith(org + "/" + request + "/"),
    ),
  ).toBe(true);
  expect(result.plan?.photos.map((p) => p.path)).toEqual(
    result.plan?.photos.map((p) => p.path).sort(),
  );
  expect(f.filters).toContainEqual({
    table: "projects",
    column: "organization_id",
    value: org,
  });
  expect(f.rpc).toHaveBeenCalledWith("prepare_project_observation", {
    org,
    project,
    observation: request,
    visit_body: "Revisión de prueba",
    visit_date: "2026-01-01",
    photo_sizes: [2097152, 2097152, 2097152, 2097152, 2097152],
  });
  expect(JSON.stringify(f.rpc.mock.calls).length).toBeLessThan(1000);
});
it("rechaza lectores, proyectos ajenos, fotos grandes y archivos en FormData sin crear filas", async () => {
  const f = fixture();
  f.role("reader");
  expect((await prepareObservation(form(), [], request)).error).toMatch("rol");
  f.role("owner");
  f.available(false);
  expect((await prepareObservation(form(), [], request)).error).toMatch(
    "proyecto",
  );
  f.available(true);
  expect(
    (
      await prepareObservation(
        form(),
        [{ type: "image/jpeg", size: 2097153 }],
        request,
      )
    ).error,
  ).toBeTruthy();
  const withBytes = form();
  withBytes.set(
    "photos",
    new File(["imagen"], "foto.jpg", { type: "image/jpeg" }),
  );
  expect((await prepareObservation(withBytes, [], request)).error).toMatch(
    "directamente",
  );
  const future = form();
  future.set("observed_on", "2999-01-01");
  expect((await prepareObservation(future, [], request)).error).toBeTruthy();
  expect(f.inserted).toHaveLength(0);
});
it("recupera una preparación cuya respuesta se perdió usando el mismo identificador", async () => {
  const f = fixture();
  f.observation({
    id: request,
    project_id: project,
    body: "Revisión de prueba",
    observed_on: "2026-01-01",
  });
  const result = await prepareObservation(form(), [], request);
  expect(result.plan).toEqual({ observation: request, photos: [] });
  expect(f.inserted).toHaveLength(0);
});
it("finalizar y descartar limitan la búsqueda al autor y no escriben sobre registros ajenos", async () => {
  const f = fixture();
  expect((await finishObservation(request)).error).toBeTruthy();
  expect((await cancelObservation(request)).success).toBeTruthy();
  expect(f.filters).toContainEqual({
    table: "project_observations",
    column: "created_by",
    value: user,
  });
  expect(f.filters).toContainEqual({
    table: "project_observations",
    column: "organization_id",
    value: org,
  });
  expect(mocks.publish).not.toHaveBeenCalled();
  expect(f.rpc).not.toHaveBeenCalled();
});
it("una publicación confirmada se reconoce al reintentar y no se duplica ni se descarta", async () => {
  const f = fixture();
  f.observation({ id: request, project_id: project, published: true });
  expect((await finishObservation(request)).success).toBeTruthy();
  expect((await cancelObservation(request)).success).toMatch("conservó");
  expect(mocks.publish).not.toHaveBeenCalled();
  expect(f.rpc).not.toHaveBeenCalled();
  expect(mocks.revalidate).toHaveBeenCalledWith("/proyectos/" + project);
});
it("una confirmación fallida queda como error y no limpia ni descarta el registro", async () => {
  const f = fixture();
  f.observation({ id: request, project_id: project, published: false });
  mocks.publish.mockRejectedValueOnce(new Error("Reintenta sin duplicar"));
  expect((await finishObservation(request)).error).toMatch("sin duplicar");
  expect(f.rpc).not.toHaveBeenCalled();
});
it("conserva la redirección Auth original en vez de convertirla en éxito o error genérico", async () => {
  fixture();
  mocks.context.mockRejectedValue(new Error("NEXT_REDIRECT"));
  await expect(finishObservation(request)).rejects.toThrow("NEXT_REDIRECT");
});
