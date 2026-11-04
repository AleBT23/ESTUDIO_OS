import { createHash } from "node:crypto";
import { getContext } from "@/shared/auth/context";
export async function GET(request: Request) {
  const headers = {
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
  };
  const ctx = await getContext();
  if (!ctx?.organization || ctx.membership?.role !== "owner")
    return new Response(null, { status: 403, headers });
  const section = new URL(request.url).searchParams.get("seccion") ?? "todo";
  const { data, error } = await ctx.db.rpc("export_workspace", {
    org: ctx.organization.id,
    section_name: section,
  });
  if (error || typeof data !== "string") {
    if (error?.code === "54000")
      return new Response(
        "El archivo supera el límite de descarga. Selecciona una sección más pequeña.",
        { status: 413, headers },
      );
    return new Response("No se pudo exportar el estudio.", {
      status:
        error?.code === "22023" ? 400 : error?.code === "42501" ? 403 : 503,
      headers,
    });
  }
  const digest = createHash("sha256").update(data).digest("hex");
  return new Response(data, {
    headers: {
      ...headers,
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="estudio-os-${digest}.json"`,
      "X-Checksum-SHA256": digest,
    },
  });
}
