import { z } from "zod";
import { getContext } from "@/shared/auth/context";
import { canReadFinance } from "@/shared/permissions";
import { renderReceipt } from "@/modules/finance/movement-receipt";
export const runtime = "nodejs";
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getContext();
  const headers = { "Cache-Control": "private, no-store" };
  if (
    !ctx?.organization ||
    !ctx.membership ||
    !canReadFinance(ctx.membership.role)
  )
    return new Response(null, { status: 403, headers });
  const { id } = await params;
  const source = new URL(request.url).searchParams.get("origen");
  if (
    !z.uuid().safeParse(id).success ||
    (source !== "proyecto" && source !== "acuerdo")
  )
    return new Response(null, { status: 404, headers });
  const result = await ctx.db
    .from("movement_receipts")
    .select("*")
    .eq("organization_id", ctx.organization.id)
    .eq("source", source)
    .eq("id", id)
    .maybeSingle();
  if (result.error) return new Response(null, { status: 503, headers });
  if (!result.data) return new Response(null, { status: 404, headers });
  const bytes = await renderReceipt(ctx.organization.name, result.data);
  return new Response(new Uint8Array(bytes), {
    headers: {
      ...headers,
      "Content-Type": "application/pdf",
      "Content-Disposition": 'attachment; filename="recibo-' + id + '.pdf"',
    },
  });
}
