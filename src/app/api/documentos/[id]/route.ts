import { createHash } from "node:crypto";
import { z } from "zod";
import { getContext } from "@/shared/auth/context";
import { canManageCommercial } from "@/shared/permissions";
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getContext();
  if (
    !ctx?.organization ||
    !ctx.membership ||
    !canManageCommercial(ctx.membership.role)
  )
    return new Response("Acceso no autorizado", { status: 403 });
  const { id } = await params;
  if (!z.uuid().safeParse(id).success)
    return new Response("Referencia inválida", { status: 400 });
  let documentResult = await ctx.db
    .from("quote_versions")
    .select("storage_path,folio,sha256")
    .eq("organization_id", ctx.organization.id)
    .eq("id", id)
    .eq("state", "issued")
    .maybeSingle();
  if (!documentResult.error && !documentResult.data) {
    documentResult = await ctx.db
      .from("generated_documents")
      .select("storage_path,folio,sha256")
      .eq("organization_id", ctx.organization.id)
      .eq("id", id)
      .eq("state", "issued")
      .maybeSingle();
  }
  const { data, error } = documentResult;
  if (error)
    return new Response("No se pudo consultar la versión", { status: 503 });
  if (!data) return new Response("Documento no disponible", { status: 404 });
  const object = await ctx.db.storage
    .from("estudio-documents")
    .download(data.storage_path);
  if (object.error)
    return new Response("No se pudo recuperar el documento", { status: 503 });
  const bytes = new Uint8Array(await object.data.arrayBuffer());
  if (createHash("sha256").update(bytes).digest("hex") !== data.sha256)
    return new Response("La verificación de integridad del PDF falló", {
      status: 409,
    });
  return new Response(bytes, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${data.folio}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
