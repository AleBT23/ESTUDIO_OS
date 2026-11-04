import { z } from "zod";
import { getContext } from "@/shared/auth/context";
import { canReadFinance } from "@/shared/permissions";
import { receiptInfo } from "@/modules/finance/receipt-file";
export async function GET(
  _: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getContext(),
    { id } = await params,
    headers = { "Cache-Control": "private, no-store" };
  if (
    !ctx?.organization ||
    !ctx.membership ||
    !canReadFinance(ctx.membership.role)
  )
    return new Response(null, { status: 403, headers });
  if (!z.uuid().safeParse(id).success)
    return new Response(null, { status: 404, headers });
  const r = await ctx.db
    .from("available_receipts")
    .select("sha256,mime,size_bytes,storage_path")
    .eq("organization_id", ctx.organization.id)
    .eq("id", id)
    .maybeSingle();
  if (r.error || !r.data)
    return new Response(null, { status: r.error ? 503 : 404, headers });
  const download = await ctx.db.storage
    .from("finance-receipts")
    .download(r.data.storage_path);
  if (download.error) return new Response(null, { status: 503, headers });
  const raw = await download.data.arrayBuffer(),
    info = receiptInfo(Buffer.from(raw));
  if (
    !info ||
    info.sha256 !== r.data.sha256 ||
    info.mime !== r.data.mime ||
    info.size_bytes !== r.data.size_bytes
  )
    return new Response(null, { status: 409, headers });
  const ext =
    info.mime === "application/pdf"
      ? "pdf"
      : info.mime === "image/png"
        ? "png"
        : "jpg";
  return new Response(raw, {
    headers: {
      ...headers,
      "Content-Type": info.mime,
      "Content-Disposition":
        'attachment; filename="comprobante-' + id + "." + ext + '"',
    },
  });
}
