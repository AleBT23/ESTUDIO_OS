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
  try {
    const pdf = await new StandaloneRenderer().render(
      await standalonePreview(id),
    );
    return new Response(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'inline; filename="documento-estudio.pdf"',
        "Cache-Control": "private, no-store",
        "X-Frame-Options": "SAMEORIGIN",
        "Content-Security-Policy": "frame-ancestors 'self'",
      },
    });
  } catch {
    return new Response(
      "No se pudo previsualizar. Revisa el documento guardado y los datos requeridos por sus variables.",
      { status: 422 },
    );
  }
}
