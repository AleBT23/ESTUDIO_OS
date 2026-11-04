import { z } from "zod";
import { getContext } from "@/shared/auth/context";
export async function GET(
  _: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getContext(),
    { id } = await params,
    headers = { "Cache-Control": "private, no-store" };
  if (!ctx?.organization) return new Response(null, { status: 403, headers });
  if (!z.uuid().safeParse(id).success)
    return new Response(null, { status: 404, headers });
  const { data, error } = await ctx.db
    .from("dossier_files")
    .select("filename,attachment")
    .eq("organization_id", ctx.organization.id)
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  if (error || !data?.attachment)
    return new Response(null, { status: error ? 503 : 404, headers });
  const filename = encodeURIComponent(data.filename).replace(
    /['()*]/g,
    (c) => "%" + c.charCodeAt(0).toString(16),
  );
  return new Response(
    new Uint8Array(Buffer.from(data.attachment.slice(2), "hex")),
    {
      headers: {
        ...headers,
        "Content-Type": "application/octet-stream",
        "X-Content-Type-Options": "nosniff",
        "Content-Disposition": "attachment; filename*=UTF-8''" + filename,
      },
    },
  );
}
