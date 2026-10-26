import { pdfFailureDetails } from "@/modules/documents/pdf-diagnostics";
import { z } from "zod";
import { getContext } from "@/shared/auth/context";
import { canManageCommercial } from "@/shared/permissions";
import { standalonePreview } from "@/modules/documents/standalone-preview";
import { StandaloneRenderer } from "@/modules/documents/standalone-renderer";
export const runtime = "nodejs";
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getContext();
  if (!ctx?.membership || !canManageCommercial(ctx.membership.role))
    return new Response("Acceso no autorizado", { status: 403 });
  const { id } = await params;
  if (!z.uuid().safeParse(id).success)
    return new Response("Referencia inválida", { status: 400 });
  let stage: "snapshot" | "render" = "snapshot";
  try {
    const snapshot = await standalonePreview(id);
    stage = "render";
    const pdf = await new StandaloneRenderer().render(snapshot);
    return new Response(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'inline; filename="documento-estudio.pdf"',
        "Cache-Control": "private, no-store",
        "X-Frame-Options": "SAMEORIGIN",
        "Content-Security-Policy": "frame-ancestors 'self'",
      },
    });
  } catch (error) {
    console.error("STUDIO_PDF_PREVIEW_FAILED", pdfFailureDetails(error, stage));
    return new Response(
      "No se pudo previsualizar. Revisa el documento guardado y los datos requeridos por sus variables.",
      { status: 422 },
    );
  }
}
