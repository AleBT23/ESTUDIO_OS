import { pdfFailureDetails } from "@/modules/documents/pdf-diagnostics";
import { z } from "zod";
import { getContext } from "@/shared/auth/context";
import { canManageCommercial } from "@/shared/permissions";
import {
  defaultDocumentOptions,
  documentOptionsSchema,
} from "@/modules/documents/schema";
import { previewSnapshot } from "@/modules/documents/preview";
import { ReactPdfRenderer } from "@/modules/documents/pdf-renderer";
export const runtime = "nodejs";
export async function GET(
  request: Request,
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
  const raw = new URL(request.url).searchParams.get("options");
  if (raw && raw.length > 5000)
    return new Response("Opciones demasiado extensas", { status: 400 });
  let stage: "snapshot" | "render" = "snapshot";
  try {
    const options = documentOptionsSchema.parse(
      raw ? JSON.parse(raw) : defaultDocumentOptions,
    );
    const snapshot = await previewSnapshot(id, options);
    stage = "render";
    const pdf = await new ReactPdfRenderer().render(snapshot);
    return new Response(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'inline; filename="vista-previa.pdf"',
        "Cache-Control": "private, no-store",
        "X-Frame-Options": "SAMEORIGIN",
        "Content-Security-Policy": "frame-ancestors 'self'",
      },
    });
  } catch (error) {
    console.error("QUOTE_PDF_PREVIEW_FAILED", pdfFailureDetails(error, stage));
    return new Response(
      "No se pudo generar la vista previa. Revisa la propuesta guardada.",
      { status: 422 },
    );
  }
}
