import "server-only";
import { requireContext } from "@/shared/auth/context";
import { canManageCommercial } from "@/shared/permissions";
import { normalizeDocumentImage } from "./document-image";
type Context = Pick<
  Awaited<ReturnType<typeof requireContext>>,
  "db" | "organization" | "membership"
>;
export function listLibraryImages(ctx: Context) {
  return ctx.db
    .from("current_library_resources")
    .select("id,title,filename,version")
    .eq("organization_id", ctx.organization.id)
    .or("filename.ilike.%.png,filename.ilike.%.jpg,filename.ilike.%.jpeg")
    .order("title")
    .order("id")
    .limit(100);
}
export async function loadLibraryImage(ctx: Context, id: string) {
  if (!canManageCommercial(ctx.membership.role))
    throw Error("Permisos insuficientes.");
  const { data, error } = await ctx.db
    .from("library_revisions")
    .select("attachment")
    .eq("organization_id", ctx.organization.id)
    .eq("id", id)
    .maybeSingle();
  if (error || !data?.attachment)
    throw Error("Imagen no disponible en la biblioteca de este estudio.");
  return normalizeDocumentImage(Buffer.from(data.attachment.slice(2), "hex"));
}
