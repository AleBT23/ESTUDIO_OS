import "server-only";
import { requireContext } from "@/shared/auth/context";
import { canManageCommercial } from "@/shared/permissions";
import { StandaloneRenderer } from "./standalone-renderer";
import type { StandaloneSnapshot } from "./standalone-schema";
import { documentImageIds } from "./image-references";
import { normalizeDocumentImage } from "./document-image";

export async function renderStudioDocument(snapshot: StandaloneSnapshot) {
  const ids = documentImageIds(snapshot.body);
  const images = new Map<string, Buffer>();
  if (ids.length) {
    const ctx = await requireContext();
    if (!canManageCommercial(ctx.membership.role))
      throw Error("Permisos insuficientes.");
    for (const id of ids) {
      const result = await ctx.db
        .from("library_revisions")
        .select("attachment")
        .eq("organization_id", ctx.organization.id)
        .eq("id", id)
        .maybeSingle();
      if (result.error || !result.data?.attachment)
        throw Error("Imagen no disponible en la biblioteca de este estudio.");
      images.set(
        id,
        await normalizeDocumentImage(
          Buffer.from(result.data.attachment.slice(2), "hex"),
        ),
      );
    }
  }
  return new StandaloneRenderer().render(snapshot, images);
}
