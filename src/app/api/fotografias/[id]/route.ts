import { z } from "zod";
import { getContext } from "@/shared/auth/context";
export async function GET(
  _: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const unavailable = (status: number) =>
    new Response(status === 401 ? "Inicia sesión." : "No disponible.", {
      status,
      headers: { "Cache-Control": "private, no-store" },
    });
  const ctx = await getContext();
  if (!ctx?.organization) return unavailable(401);
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) return unavailable(404);
  const { data, error } = await ctx.db
    .from("project_photos")
    .select("storage_path")
    .eq("organization_id", ctx.organization.id)
    .eq("id", id)
    .maybeSingle();
  if (error || !data) return unavailable(404);
  const photo = await ctx.db.storage
    .from("project-photos")
    .download(data.storage_path);
  if (photo.error || !photo.data) return unavailable(404);
  return new Response(photo.data.stream(), {
    headers: {
      "Content-Type": "image/jpeg",
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Disposition": `inline; filename="registro-${id}.jpg"`,
    },
  });
}
