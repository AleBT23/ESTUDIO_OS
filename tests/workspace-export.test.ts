import { expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
import { GET } from "@/app/api/exportacion/route";
const { getContext } = vi.hoisted(() => ({ getContext: vi.fn() }));
vi.mock("@/shared/auth/context", () => ({ getContext }));
const request = new Request(
  "http://localhost/api/exportacion?seccion=finanzas",
);
it("descarga los bytes originales y conserva precisión, huella y permisos", async () => {
  const data = '{"importe":9007199254740999,"nombre":"Diseño"}';
  const rpc = vi.fn().mockResolvedValue({ data, error: null });
  getContext.mockResolvedValue({
    organization: { id: "a" },
    membership: { role: "owner" },
    db: { rpc },
  });
  const response = await GET(request);
  expect(await response.text()).toBe(data);
  expect(response.headers.get("content-disposition")).toContain(
    createHash("sha256").update(data).digest("hex"),
  );
  expect(rpc).toHaveBeenCalledWith("export_workspace", {
    org: "a",
    section_name: "finanzas",
  });
  getContext.mockResolvedValue({
    organization: { id: "a" },
    membership: { role: "admin" },
    db: { rpc },
  });
  expect((await GET(request)).status).toBe(403);
  expect(rpc).toHaveBeenCalledTimes(1);
});
it("verifica la huella sobre los bytes y rechaza un archivo manipulado o con conteos falsos", async () => {
  const { verifyWorkspaceExport } =
    await import("@/shared/db/workspace-export");
  const file = (text: string, name?: string) =>
    new File(
      [text],
      name ??
        "estudio-os-" +
          createHash("sha256").update(text).digest("hex") +
          ".json",
    );
  const payload = {
    format: "estudio-os-workspace",
    version: 1,
    organization_id: "a",
    exported_at: "2026-11-04",
    collections: {
      clients: { count: 1, rows: [{ organization_id: "a", name: "María" }] },
    },
  };
  const good = file(JSON.stringify(payload));
  expect(await verifyWorkspaceExport(good)).toMatchObject({
    collections: 1,
    records: 1,
  });
  await expect(verifyWorkspaceExport(file("{}", good.name))).rejects.toThrow(
    "huella",
  );
  payload.collections.clients.count = 2;
  await expect(
    verifyWorkspaceExport(file(JSON.stringify(payload))),
  ).rejects.toThrow("conteos");
});
